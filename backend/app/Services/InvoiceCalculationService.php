<?php

namespace App\Services;

use App\Enums\ContractStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Contract;
use App\Models\ContractPrinter;
use App\Models\Invoice;
use App\Models\Printer;
use App\Models\Reading;
use App\Support\CicloFacturacion;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class InvoiceCalculationService
{
    /**
     * Cache contextual de solo lectura: entre llamadas consecutivas de un
     * mismo flujo de estimacion (pendientes de un contrato) el contrato,
     * la ultima lectura facturada y las lecturas huerfanas no cambian. Se
     * activa UNICAMENTE dentro de conCacheContextual(): los flujos que
     * escriben detalles entre llamadas (batch) nunca la usan, porque sus
     * querys deben ver los detalles recien creados.
     *
     * @var array<string, mixed>
     */
    private array $cacheContextual = [];

    private int $nivelContextoLectura = 0;

    /**
     * Ejecuta $callback con la cache contextual activa y la limpia al
     * salir. ContractBillingService lo usa para el bucle de pendientes.
     *
     * @template T
     * @param  callable(): T  $callback
     * @return T
     */
    public function conCacheContextual(callable $callback): mixed
    {
        $this->nivelContextoLectura++;

        try {
            return $callback();
        } finally {
            if (--$this->nivelContextoLectura === 0) {
                $this->cacheContextual = [];
            }
        }
    }

    /**
     * @template T
     * @param  callable(): T  $productor
     * @return T
     */
    private function cacheContextual(string $clave, callable $productor): mixed
    {
        if ($this->nivelContextoLectura === 0) {
            return $productor();
        }

        return $this->cacheContextual[$clave] ??= $productor();
    }

    /**
     * Calcula la estimacion de facturacion de un cliente para un periodo,
     * agrupando las lecturas no facturadas por contrato y aplicando la
     * formula de tarifa de cada contrato.
     *
     * @param  int|null  $excluirFacturaId    Excluye una factura del detector de
     *                                        solapamiento y de la derivacion de
     *                                        la ultima lectura facturada (usado
     *                                        al recalcular un borrador para no
     *                                        contar contra si mismo).
     * @param  int|null  $contratoId          Limita el calculo a un contrato del
     *                                        cliente (borradores por contrato).
     * @param  bool      $exigirContratoActivo  La guarda ACTIVO aplica a los flujos
     *                                        de facturacion; el estado de facturacion
     *                                        la omite para listar pendientes de
     *                                        contratos FINALIZADOS (informativos).
     * @param  string|null  $baseLecturaFacturada  Override de la fecha de la ultima
     *                                        lectura facturada del contrato (Y-m-d).
     *                                        Solo aplica al rango alineado a ciclo;
     *                                        lo usa ContractBillingService para
     *                                        hilavar la simulacion de pendientes
     *                                        consecutivos (D22).
     * @return array{monto_total: float, contratos: array, detalles: array, advertencias: array}
     */
    public function calcularEstimacion(
        int $clienteId,
        string $periodoInicio,
        string $periodoFin,
        ?int $excluirFacturaId = null,
        ?int $contratoId = null,
        bool $exigirContratoActivo = true,
        ?string $baseLecturaFacturada = null,
    ): array {
        if ($contratoId !== null) {
            $this->validarContratoFacturable($contratoId, $clienteId, $exigirContratoActivo);
        }

        // Con exigirContratoActivo=false el estado no filtra: el flujo de
        // pendientes estima tambien contratos FINALIZADOS (informativo, la
        // guarda de facturabilidad ya no aplico en validarContratoFacturable).
        $contratos = $this->cacheContextual(
            "contratos:{$clienteId}:{$contratoId}:" . ($exigirContratoActivo ? '1' : '0'),
            fn () => Contract::where('cliente_id', $clienteId)
                ->when($exigirContratoActivo, fn ($query) => $query->where('estado', ContractStatus::ACTIVO))
                ->when($contratoId, fn ($query) => $query->where('id', $contratoId))
                ->with(['activePrinters', 'planImpresoras'])
                ->get(),
        );

        $advertencias = [];
        $detalles = [];
        $contratosResult = [];
        $montoTotal = 0.0;

        // Advertencia de periodo multi-mes: tarifa_base y paginas_incluidas
        // se aplican una sola vez por factura, asi que un rango largo
        // subcobra la renta. Umbral 1.5 meses para evitar falsos positivos
        // con meses de 31 dias. No bloqueante (como el resto de advertencias).
        $duracionMeses = abs(Carbon::parse($periodoFin)->floatDiffInMonths(Carbon::parse($periodoInicio)));
        if ($duracionMeses > 1.5) {
            $advertencias[] = sprintf(
                'El periodo cubre aproximadamente %d meses: la tarifa base y las páginas incluidas se aplican una sola vez por factura. Considera facturar mes a mes.',
                (int) ceil($duracionMeses)
            );
        }

        if ($contratos->isEmpty()) {
            $advertencias[] = 'El cliente no tiene contratos activos. Se recomienda usar el modo de monto manual.';
            return [
                'monto_total' => 0.0,
                'contratos' => [],
                'detalles' => [],
                'advertencias' => $advertencias,
            ];
        }

        // D22 — arrastre de consumo: solo cuando el calculo se limita a un
        // contrato y el rango coincide exactamente con los bounds de un ciclo
        // (batch de ciclos, recalculo de esos borradores y estimacion de
        // pendientes). El wizard de rango libre conserva whereBetween + 1x.
        $cicloAlineado = null;
        if ($contratoId !== null && $contratos->count() === 1) {
            $contratoUnico = $contratos->first();
            $inicioDia = Carbon::parse($periodoInicio)->startOfDay();
            $finDia = Carbon::parse($periodoFin)->startOfDay();
            if (CicloFacturacion::esRangoAlineadaACiclo($contratoUnico, $inicioDia, $finDia)) {
                $cicloAlineado = [
                    'contrato' => $contratoUnico,
                    'ciclo' => CicloFacturacion::cicloQueContiene($contratoUnico, $finDia),
                ];
            }
        }

        // Ruta compartida (wizard / rangos libres): lecturas del periodo por
        // ventanas de asignacion. En la ruta ciclo-alineado se salta: las
        // lecturas del contrato se derivan por hueco en infoCicloAlineado.
        $lecturasConContrato = collect();
        if ($cicloAlineado === null) {
            // Motor por ventanas: impresoras de todas las asignaciones del
            // contrato cuya ventana [fecha_asignacion, fecha_liberacion ?? ∞]
            // intersecta el periodo. Una lectura de cierre creada al retirar la
            // impresora a mitad de periodo ya no se excluye del cálculo (P2).
            $ventanas = ContractPrinter::whereIn('contrato_id', $contratos->modelKeys())
                ->where('fecha_asignacion', '<=', $periodoFin)
                ->where(function ($query) use ($periodoInicio) {
                    $query->whereNull('fecha_liberacion')
                        ->orWhere('fecha_liberacion', '>=', $periodoInicio);
                })
                ->get();

            $idsImpresoras = $ventanas->pluck('impresora_id')->unique()->values()->all();

            if (empty($idsImpresoras)) {
                $advertencias[] = 'Los contratos activos del cliente no tienen impresoras asignadas.';
            }

            // Brechas: ventanas liberadas sin lectura de cierre que tocan el
            // periodo -> el tramo "última lectura -> retiro" no se factura.
            $seriesPorImpresora = $ventanas->isEmpty()
                ? collect()
                : Printer::whereIn('id', $ventanas->pluck('impresora_id')->unique())
                    ->pluck('num_serie', 'id');
            $codigosPorContrato = $contratos->pluck('codigo_negocio', 'id');

            foreach ($ventanas->where('activa', false)->whereNull('lectura_final') as $ventana) {
                $advertencias[] = sprintf(
                    'La impresora %s fue liberada del contrato %s sin lectura de cierre; las páginas desde su última lectura no se facturan.',
                    $seriesPorImpresora[$ventana->impresora_id] ?? ('#' . $ventana->impresora_id),
                    $codigosPorContrato[$ventana->contrato_id] ?? ('#' . $ventana->contrato_id),
                );
            }

            // Lecturas candidatas del periodo para esas impresoras.
            $lecturas = collect();
            if (!empty($idsImpresoras)) {
                $lecturas = Reading::whereIn('impresora_id', $idsImpresoras)
                    ->whereBetween('fecha', [$periodoInicio, $periodoFin])
                    ->get();
            }

            // Excluir las ya facturadas: consulta acotada solo a las lecturas
            // candidatas del periodo (no a toda la tabla invoice_details).
            if ($lecturas->isNotEmpty()) {
                $idsCandidatos = $lecturas->pluck('id')->all();
                $lecturasFacturadas = (clone $this->lecturasYaFacturadas($excluirFacturaId))
                    ->whereIn('lectura_id', $idsCandidatos)
                    ->pluck('lectura_id')
                    ->all();

                if (!empty($lecturasFacturadas)) {
                    $lecturas = $lecturas->reject(
                        fn ($l) => in_array($l->id, $lecturasFacturadas, true)
                    )->values();
                }
            }

            // Lecturas sin contrato asignado -> advertencia, fuera del monto.
            $lecturasSinContrato = $lecturas->filter(fn ($l) => $l->contrato_id === null);
            foreach ($lecturasSinContrato as $lectura) {
                $advertencias[] = sprintf(
                    'La lectura #%d (impresora #%d, %s) no tiene contrato asignado y no se incluyo en el calculo.',
                    $lectura->id,
                    $lectura->impresora_id,
                    $lectura->fecha?->toDateString(),
                );
            }

            // Solo lecturas con contrato para el calculo.
            $lecturasConContrato = $lecturas->filter(fn ($l) => $l->contrato_id !== null);
        }

        foreach ($contratos as $contrato) {
            $esAlineado = $cicloAlineado !== null
                && (int) $cicloAlineado['contrato']->id === (int) $contrato->id;

            if ($esAlineado) {
                $infoCiclo = $this->infoCicloAlineado(
                    $contrato,
                    (int) $cicloAlineado['ciclo'],
                    $excluirFacturaId,
                    $baseLecturaFacturada,
                );
                $lecturasContrato = $infoCiclo['lecturas'];
                $advertencias = array_merge($advertencias, $infoCiclo['advertencias']);
                $multiplicador = $infoCiclo['ciclos_acumulados'];
                $incluidasEfectivas = $infoCiclo['paginas_incluidas_efectivas'];
                $lecturaCierreFecha = $infoCiclo['lectura_cierre_fecha'];
            } else {
                $lecturasContrato = $lecturasConContrato->where('contrato_id', $contrato->id)->values();
                $multiplicador = 1;
                $incluidasEfectivas = (int) $contrato->paginas_incluidas;
                $lecturaCierreFecha = null;
            }

            $totalPages = (int) $lecturasContrato->sum('paginas_periodo');
            $montoContrato = $contrato->calculateEstimatedAmount(
                $totalPages,
                $esAlineado ? $incluidasEfectivas : null,
            );
            $montoContratoRedondeado = round($montoContrato, 2);
            // Acumular el monto ya redondeado por contrato para que
            // monto_total == Σ monto_contrato == Σ monto_calculado exacto.
            $montoTotal += $montoContratoRedondeado;

            $lecturasData = [];
            foreach ($lecturasContrato as $lectura) {
                $lecturasData[] = [
                    'lectura_id' => $lectura->id,
                    'impresora_id' => $lectura->impresora_id,
                    'fecha' => $lectura->fecha?->toDateString(),
                    'paginas_periodo' => $lectura->paginas_periodo,
                ];
            }

            $contratosResult[] = [
                'contrato_id' => $contrato->id,
                'codigo' => $contrato->codigo_negocio,
                'tarifa_base' => (float) $contrato->tarifa_base,
                'paginas_incluidas' => $contrato->paginas_incluidas,
                'costo_pag_excedente' => (float) $contrato->costo_pag_excedente,
                'total_paginas' => $totalPages,
                'monto_contrato' => $montoContratoRedondeado,
                'lecturas' => $lecturasData,
                'ciclos_acumulados' => $multiplicador,
                'paginas_incluidas_efectivas' => $incluidasEfectivas,
                'lectura_cierre_fecha' => $lecturaCierreFecha,
            ];

            // Construir detalles para este contrato.
            if ($lecturasContrato->isNotEmpty()) {
                // Distribuir montoContrato entre las lecturas (proporcional al
                // numero de paginas; si todas son 0, el monto completo cae en
                // la ultima fila). Vincula cada lectura para marcarla facturada.
                // Absorber el redondeo en la ultima fila para que sume exacto.
                $acumulado = 0.0;
                $count = $lecturasContrato->count();
                foreach ($lecturasContrato as $index => $lectura) {
                    if ($index === $count - 1) {
                        $monto = round($montoContrato - $acumulado, 2);
                    } else {
                        $prop = $totalPages > 0 ? ((float) $lectura->paginas_periodo / $totalPages) : 0.0;
                        $monto = round($montoContrato * $prop, 2);
                        $acumulado += $monto;
                    }

                    $detalles[] = [
                        'contrato_id' => $contrato->id,
                        'impresora_id' => $lectura->impresora_id,
                        'lectura_id' => $lectura->id,
                        'paginas_consumidas' => $lectura->paginas_periodo,
                        'monto_calculado' => $monto,
                    ];
                }
            } elseif ($montoContratoRedondeado > 0) {
                // Contrato de renta fija sin lecturas en el periodo, o ciclo
                // alineado sin lectura de corte (D22: renta base sola, el
                // consumo rueda al siguiente ciclo con corte).
                $detalles[] = [
                    'contrato_id' => $contrato->id,
                    'impresora_id' => null,
                    'lectura_id' => null,
                    'paginas_consumidas' => 0,
                    'monto_calculado' => $montoContratoRedondeado,
                ];
            }

            if ($totalPages === 0 && (float) $contrato->tarifa_base === 0.0) {
                $advertencias[] = sprintf(
                    'El contrato %s no tuvo lecturas en el periodo y su tarifa base es 0 (sin costo).',
                    $contrato->codigo_negocio,
                );
            }

            // D-H: el plan es intención comercial; si faltan equipos por
            // instalar se advierte (no bloquea, no altera montos).
            $totalPlan = (int) $contrato->planImpresoras->sum('cantidad');
            if ($totalPlan > 0) {
                $instaladas = $contrato->activePrinters->count();
                if ($totalPlan > $instaladas) {
                    $advertencias[] = sprintf(
                        'El contrato %s tiene %d equipo(s) planificados sin instalar.',
                        $contrato->codigo_negocio,
                        $totalPlan - $instaladas,
                    );
                }
            }
        }

        // Lecturas ligadas a contratos no activos (o que no pertenecen a los
        // contratos activos del cliente): no se facturan, pero se advierten.
        $activeContractIds = $contratos->modelKeys();
        foreach ($lecturasConContrato as $lectura) {
            if (!in_array($lectura->contrato_id, $activeContractIds, true)) {
                $advertencias[] = sprintf(
                    'La lectura #%d (impresora #%d, %s) esta ligada al contrato #%d que no esta activo y no se incluyo en el calculo.',
                    $lectura->id,
                    $lectura->impresora_id,
                    $lectura->fecha?->toDateString(),
                    $lectura->contrato_id,
                );
            }
        }

        if ($lecturasConContrato->isEmpty() && $montoTotal == 0.0) {
            $advertencias[] = 'No se encontraron lecturas no facturadas en el periodo seleccionado.';
        }

        // Detector de solapamiento de periodos (advertencia, no bloqueante):
        // cualquier factura del cliente (incluidos borradores) cuyo periodo
        // intersecte el solicitado. Los bloqueos duros llegan en Fase 1.
        $solapadas = Invoice::where('cliente_id', $clienteId)
            ->whereNotNull('periodo_inicio')
            ->whereNotNull('periodo_fin')
            ->where('periodo_inicio', '<=', $periodoFin)
            ->where('periodo_fin', '>=', $periodoInicio)
            ->when($excluirFacturaId, fn ($q, $id) => $q->where('id', '!=', $id))
            ->orderBy('id')
            ->get(['id', 'numero_factura', 'periodo_inicio', 'periodo_fin']);

        foreach ($solapadas as $existente) {
            $advertencias[] = sprintf(
                'El periodo se solapa con la factura %s (%s a %s). Verifica que no se este facturando dos veces el mismo periodo.',
                $existente->numero_factura ?? 'en borrador sin folio #' . $existente->id,
                $existente->periodo_inicio->toDateString(),
                $existente->periodo_fin->toDateString(),
            );
        }

        return [
            'monto_total' => round($montoTotal, 2),
            'contratos' => $contratosResult,
            'detalles' => $detalles,
            'advertencias' => $advertencias,
        ];
    }

    /**
     * D22 — calculo del ciclo alineado de un contrato: lecturas del hueco
     * (desde la ultima lectura facturada hasta la ventana de cierre),
     * decision medido/renta-base por existencia de lectura de corte y
     * M-derivation del multiplicador del paquete.
     *
     * M = ciclo que contiene la fecha de la ultima lectura facturada (-1 si
     * nunca ha habido); el allowance del ciclo N cubre los ciclos (M, N]. Los
     * ciclos a renta base no facturan lecturas ni consumen allowance, asi que
     * el multiplicador crece hasta el siguiente ciclo con lectura de corte.
     *
     * @param  int       $ciclo                 Indice N del ciclo que se factura.
     * @param  int|null  $excluirFacturaId      Factura excluida de "ya facturado" (recalculo).
     * @param  string|null  $baseLecturaFacturada  Override de la ultima lectura facturada (simulacion).
     * @return array{lecturas: \Illuminate\Support\Collection<int, Reading>, ciclos_acumulados: int, paginas_incluidas_efectivas: int, lectura_cierre_fecha: string|null, advertencias: array<int, string>}
     */
    private function infoCicloAlineado(Contract $contrato, int $ciclo, ?int $excluirFacturaId, ?string $baseLecturaFacturada): array
    {
        $bounds = CicloFacturacion::bounds($contrato, $ciclo);
        ['desde' => $ventanaDesde, 'hasta' => $ventanaHasta] = CicloFacturacion::ventanaCierre($contrato, $bounds['fin']);

        // Ultima lectura facturada del contrato: base del hueco que este
        // ciclo mide. La factura en recalculo queda fuera (sus detalles se
        // excluyen explicitamente).
        if ($baseLecturaFacturada !== null) {
            $fechaUltimaFacturada = Carbon::parse($baseLecturaFacturada)->startOfDay();
        } else {
            $ultima = $this->cacheContextual(
                "ultima:{$contrato->id}:{$excluirFacturaId}",
                fn () => DB::table('invoice_details as d')
                    ->join('readings as r', 'r.id', '=', 'd.lectura_id')
                    ->where('d.contrato_id', $contrato->id)
                    ->when($excluirFacturaId, fn ($q, $id) => $q->where('d.factura_id', '!=', $id))
                    ->orderByDesc('r.fecha')
                    ->orderByDesc('r.id')
                    ->first('r.fecha'),
            );

            $fechaUltimaFacturada = $ultima?->fecha !== null
                ? Carbon::parse($ultima->fecha)->startOfDay()
                : null;
        }

        $m = $fechaUltimaFacturada !== null
            ? CicloFacturacion::cicloQueContiene($contrato, $fechaUltimaFacturada)
            : -1;
        $multiplicador = max(1, $ciclo - $m);
        $efectivas = $multiplicador * (int) $contrato->paginas_incluidas;

        $advertencias = [];
        if ($multiplicador > 1) {
            $advertencias[] = sprintf(
                'Periodo acumulado: %d ciclo(s) × %d páginas incluidas = %d.',
                $multiplicador,
                (int) $contrato->paginas_incluidas,
                $efectivas,
            );
        }

        $noFacturadas = $this->lecturasYaFacturadas($excluirFacturaId);

        // Lecturas del hueco: no facturadas del contrato, posteriores a la
        // ultima facturada y hasta el tope de la ventana de cierre. Cota
        // inferior: sin base facturada, el hueco empieza en el inicio del
        // primer ciclo cubierto por el multiplicador (evita hidratar todo
        // el historial del contrato).
        $inicioCobertura = CicloFacturacion::bounds(
            $contrato,
            max(0, $ciclo - $multiplicador + 1),
        )['inicio']->toDateString();

        $candidatas = Reading::query()
            ->select(['id', 'impresora_id', 'fecha', 'paginas_periodo'])
            ->where('contrato_id', $contrato->id)
            ->where('fecha', '<=', $ventanaHasta->toDateString())
            ->when(
                $fechaUltimaFacturada !== null,
                fn ($q) => $q->where('fecha', '>', $fechaUltimaFacturada->toDateString()),
                fn ($q) => $q->where('fecha', '>=', $inicioCobertura),
            )
            ->whereNotIn('id', $noFacturadas)
            ->orderBy('fecha')
            ->orderBy('id')
            ->get();

        // Lecturas reguladas tarde (anteriores a la ultima facturada):
        // excluidas del calculo, solo advertencia.
        if ($fechaUltimaFacturada !== null) {
            $huerfanas = $this->cacheContextual(
                "huerfanas:{$contrato->id}:{$fechaUltimaFacturada->toDateString()}:{$excluirFacturaId}",
                fn () => Reading::query()
                    ->select(['id', 'impresora_id', 'fecha', 'paginas_periodo'])
                    ->where('contrato_id', $contrato->id)
                    ->where('fecha', '<=', $fechaUltimaFacturada->toDateString())
                    ->whereNotIn('id', (clone $noFacturadas))
                    ->orderBy('fecha')
                    ->orderBy('id')
                    ->get(),
            );

            foreach ($huerfanas as $lectura) {
                $advertencias[] = sprintf(
                    'La lectura #%d (impresora #%d, %s) es anterior a la última lectura facturada y quedó excluida del cálculo.',
                    $lectura->id,
                    $lectura->impresora_id,
                    $lectura->fecha?->toDateString(),
                );
            }
        }

        // Lectura de cierre: la ultima (fecha, id) dentro de la ventana.
        $lecturaCierre = null;
        foreach ($candidatas as $lectura) {
            $dia = $lectura->fecha?->copy()->startOfDay();
            if ($dia !== null && $dia->between($ventanaDesde, $ventanaHasta)) {
                $lecturaCierre = $lectura;
            }
        }

        if ($lecturaCierre === null) {
            // Ciclo sin lectura de corte (D22): renta base sola; las lecturas
            // tempranas (fuera de la ventana) ruedan al siguiente ciclo medido.
            $advertencias[] = 'Ciclo sin lectura de corte: se cobra solo la renta base; el consumo se acumula al siguiente ciclo con lectura de corte.';

            return [
                'lecturas' => collect(),
                'ciclos_acumulados' => $multiplicador,
                'paginas_incluidas_efectivas' => $efectivas,
                'lectura_cierre_fecha' => null,
                'advertencias' => $advertencias,
            ];
        }

        $fechaCierre = $lecturaCierre->fecha->copy()->startOfDay();

        return [
            'lecturas' => $candidatas
                ->filter(fn ($l) => $l->fecha->copy()->startOfDay()->lte($fechaCierre))
                ->values(),
            'ciclos_acumulados' => $multiplicador,
            'paginas_incluidas_efectivas' => $efectivas,
            'lectura_cierre_fecha' => $lecturaCierre->fecha->toDateString(),
            'advertencias' => $advertencias,
        ];
    }

    /**
     * Regla unica "lectura con detalle de factura = ya facturada": builder
     * de IDs de lecturas reservadas. La usa el wizard (sobre candidatos del
     * periodo) y la ruta ciclo-alineada (como subquery anti-join). El
     * recalculo excluye su propia factura para no contar contra si mismo.
     *
     * @return \Illuminate\Database\Query\Builder
     */
    private function lecturasYaFacturadas(?int $excluirFacturaId)
    {
        return DB::table('invoice_details')
            ->select('lectura_id')
            ->whereNotNull('lectura_id')
            ->when($excluirFacturaId, fn ($q, $id) => $q->where('factura_id', '!=', $id));
    }

    /**
     * Guarda de dominio: un calculo/borrador por contrato exige que el
     * contrato pertenezca al cliente y (en flujos de facturacion) este ACTIVO.
     */
    private function validarContratoFacturable(int $contratoId, int $clienteId, bool $exigirActivo): void
    {
        $contrato = $this->cacheContextual(
            "find:{$contratoId}",
            fn () => Contract::find($contratoId),
        );

        if ($contrato === null || (int) $contrato->cliente_id !== $clienteId) {
            throw new BusinessRuleException('El contrato indicado no pertenece al cliente seleccionado.');
        }

        if ($exigirActivo && $contrato->estado !== ContractStatus::ACTIVO) {
            throw new BusinessRuleException('El contrato indicado no está activo; solo se facturan contratos activos.');
        }
    }
}
