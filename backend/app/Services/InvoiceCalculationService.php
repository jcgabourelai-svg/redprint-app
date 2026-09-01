<?php

namespace App\Services;

use App\Enums\ContractStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Reading;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class InvoiceCalculationService
{
    /**
     * Calcula la estimacion de facturacion de un cliente para un periodo,
     * agrupando las lecturas no facturadas por contrato y aplicando la
     * formula de tarifa de cada contrato.
     *
     * @param  int|null  $excluirFacturaId    Excluye una factura del detector de
     *                                        solapamiento (usado al recalcular un
     *                                        borrador para no advertir contra si mismo).
     * @param  int|null  $contratoId          Limita el calculo a un contrato del
     *                                        cliente (borradores por contrato).
     * @param  bool      $exigirContratoActivo  La guarda ACTIVO aplica a los flujos
     *                                        de facturacion; el estado de facturacion
     *                                        la omite para listar pendientes de
     *                                        contratos FINALIZADOS (informativos).
     * @return array{monto_total: float, contratos: array, detalles: array, advertencias: array}
     */
    public function calcularEstimacion(
        int $clienteId,
        string $periodoInicio,
        string $periodoFin,
        ?int $excluirFacturaId = null,
        ?int $contratoId = null,
        bool $exigirContratoActivo = true,
    ): array {
        if ($contratoId !== null) {
            $this->validarContratoFacturable($contratoId, $clienteId, $exigirContratoActivo);
        }

        $contratos = Contract::where('cliente_id', $clienteId)
            ->where('estado', ContractStatus::ACTIVO)
            ->when($contratoId, fn ($query) => $query->where('id', $contratoId))
            ->with(['activePrinters', 'planImpresoras'])
            ->get();

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

        // IDs de impresoras activas de todos los contratos del cliente.
        $idsImpresoras = $contratos->flatMap->activePrinters->pluck('id')->unique()->values()->all();

        if (empty($idsImpresoras)) {
            $advertencias[] = 'Los contratos activos del cliente no tienen impresoras asignadas.';
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
            $lecturasFacturadas = DB::table('invoice_details')
                ->whereIn('lectura_id', $idsCandidatos)
                ->whereNotNull('lectura_id')
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

        foreach ($contratos as $contrato) {
            $lecturasContrato = $lecturasConContrato->where('contrato_id', $contrato->id)->values();
            $totalPages = (int) $lecturasContrato->sum('paginas_periodo');
            $montoContrato = $contrato->calculateEstimatedAmount($totalPages);
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
                // Contrato de renta fija sin ninguna lectura en el periodo.
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
     * Guarda de dominio: un calculo/borrador por contrato exige que el
     * contrato pertenezca al cliente y (en flujos de facturacion) este ACTIVO.
     */
    private function validarContratoFacturable(int $contratoId, int $clienteId, bool $exigirActivo): void
    {
        $contrato = Contract::find($contratoId);

        if ($contrato === null || (int) $contrato->cliente_id !== $clienteId) {
            throw new BusinessRuleException('El contrato indicado no pertenece al cliente seleccionado.');
        }

        if ($exigirActivo && $contrato->estado !== ContractStatus::ACTIVO) {
            throw new BusinessRuleException('El contrato indicado no está activo; solo se facturan contratos activos.');
        }
    }
}
