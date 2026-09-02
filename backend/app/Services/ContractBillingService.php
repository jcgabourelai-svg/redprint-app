<?php

namespace App\Services;

use App\Enums\ContractStatus;
use App\Models\Contract;
use App\Models\Invoice;
use App\Support\CicloFacturacion;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Estado de facturacion de un contrato: ciclos mensuales por aniversario
 * de fecha_inicio (D17) ya facturados vs pendientes, con estimacion por
 * ciclo.
 */
class ContractBillingService
{
    public function __construct(
        private InvoiceCalculationService $calculationService
    ) {}

    /**
     * @return array{facturados: array, pendientes: array, ultimo_periodo_cubierto: string|null}
     */
    public function estadoFacturacion(Contract $contrato): array
    {
        $facturas = $this->facturasQueTocanElContrato($contrato);

        $montosPorFactura = DB::table('invoice_details')
            ->where('contrato_id', $contrato->id)
            ->whereIn('factura_id', $facturas->modelKeys())
            ->groupBy('factura_id')
            ->selectRaw('factura_id, SUM(monto_calculado) AS total')
            ->pluck('total', 'factura_id');

        $facturados = $facturas
            ->sortByDesc(fn (Invoice $f) => $f->periodo_inicio->getTimestamp())
            ->values()
            ->map(fn (Invoice $f) => [
                'factura_id' => (int) $f->id,
                'numero_factura' => $f->numero_factura,
                'estado' => $f->estado->value,
                'periodo_inicio' => $f->periodo_inicio->toDateString(),
                'periodo_fin' => $f->periodo_fin->toDateString(),
                'periodo' => $f->periodo_inicio->toDateString(),
                'monto_contrato' => round((float) ($montosPorFactura[$f->id] ?? 0), 2),
                'monto_total' => (float) $f->monto_total,
            ])
            ->all();

        return [
            'facturados' => $facturados,
            'pendientes' => $this->periodosPendientes($contrato, $facturas),
            'ultimo_periodo_cubierto' => $this->ultimoPeriodoCubierto($contrato, $facturas)?->toDateString(),
        ];
    }

    /**
     * Regla de cobertura (conservadora por interseccion): facturas del
     * cliente que tocan el contrato por encabezado (mono-contrato) o por
     * detalles (multi-contrato). Incluye borradores: tambien reservan.
     */
    private function facturasQueTocanElContrato(Contract $contrato)
    {
        return Invoice::where('cliente_id', $contrato->cliente_id)
            ->whereNotNull('periodo_inicio')
            ->whereNotNull('periodo_fin')
            ->where(function ($query) use ($contrato) {
                $query->where('contrato_id', $contrato->id)
                    ->orWhereHas('details', fn ($d) => $d->where('contrato_id', $contrato->id));
            })
            ->get();
    }

    /**
     * Ciclos pendientes según reglas 2/3: del ciclo 0 hasta el ciclo en
     * curso (o el que contiene fecha_fin si el contrato FINALIZÓ; si
     * fecha_fin es null → nada pendiente). CANCELADO/SUSPENDIDO no generan.
     * Tope de 24 pendientes empaquetados (mismo límite que el batch).
     *
     * @param  iterable<Invoice>  $facturas
     * @return array<int, array{periodo: string, periodo_inicio: string, periodo_fin: string, lecturas: int, paginas: int, monto_estimado: float, advertencias: string[], actual: bool}>
     */
    private function periodosPendientes(Contract $contrato, $facturas): array
    {
        if (in_array($contrato->estado, [ContractStatus::CANCELADO, ContractStatus::SUSPENDIDO], true)) {
            return [];
        }

        $hoy = Carbon::now()->startOfDay();

        if ($contrato->estado === ContractStatus::FINALIZADO) {
            if ($contrato->fecha_fin === null) {
                return [];
            }
            $referencia = $contrato->fecha_fin->copy()->startOfDay();
        } else {
            $referencia = $hoy;
        }

        $ultimoCiclo = CicloFacturacion::cicloQueContiene($contrato, $referencia);

        $pendientes = [];
        for ($n = 0; $n <= $ultimoCiclo && count($pendientes) < 24; $n++) {
            if ($this->cicloCubierto($contrato, $n, $facturas)) {
                continue;
            }
            $pendientes[] = $this->estimadoDelCiclo($contrato, $n, $hoy);
        }

        return $pendientes;
    }

    /**
     * Cobertura conservadora: un ciclo esta cubierto si alguna factura que
     * toca el contrato intersecta su rango.
     *
     * @param  iterable<Invoice>  $facturas
     */
    private function cicloCubierto(Contract $contrato, int $n, $facturas): bool
    {
        $bounds = CicloFacturacion::bounds($contrato, $n);
        if ($bounds['inicio']->gt($bounds['fin'])) {
            // Fuera de vigencia: nada que cubrir ni listar.
            return true;
        }

        foreach ($facturas as $factura) {
            $inicioFactura = $factura->periodo_inicio->copy()->startOfDay();
            $finFactura = $factura->periodo_fin->copy()->startOfDay();
            if ($inicioFactura->lte($bounds['fin']) && $finFactura->gte($bounds['inicio'])) {
                return true;
            }
        }

        return false;
    }

    /**
     * Estimacion de un ciclo pendiente reutilizando el motor de calculo
     * limitado al contrato. Bounds del ciclo ya recortados a la vigencia
     * (regla 3).
     *
     * @return array{periodo: string, periodo_inicio: string, periodo_fin: string, lecturas: int, paginas: int, monto_estimado: float, advertencias: string[], actual: bool}
     */
    private function estimadoDelCiclo(Contract $contrato, int $ciclo, Carbon $hoy): array
    {
        $bounds = CicloFacturacion::bounds($contrato, $ciclo);

        $calc = $this->calculationService->calcularEstimacion(
            (int) $contrato->cliente_id,
            $bounds['inicio']->toDateString(),
            $bounds['fin']->toDateString(),
            null,
            (int) $contrato->id,
            // Los pendientes de contratos no ACTIVO (FINALIZADO) son
            // informativos: la guarda de facturabilidad no aplica aqui.
            false,
        );

        // El detector de solapamiento del motor es a nivel cliente: para los
        // pendientes (por definicion no cubiertos para ESTE contrato) las
        // advertencias de solape con otros contratos son ruido.
        $advertencias = array_values(array_filter(
            $calc['advertencias'],
            fn (string $a) => !str_contains($a, 'se solapa'),
        ));

        $actual = CicloFacturacion::cicloQueContiene($contrato, $hoy) === $ciclo;
        if ($actual) {
            $advertencias[] = 'Periodo en curso: las lecturas del ciclo aún están incompletas.';
        }

        return [
            'periodo' => $bounds['inicio']->toDateString(),
            'periodo_inicio' => $bounds['inicio']->toDateString(),
            'periodo_fin' => $bounds['fin']->toDateString(),
            'lecturas' => collect($calc['detalles'])->filter(fn ($d) => !empty($d['lectura_id']))->count(),
            'paginas' => (int) ($calc['contratos'][0]['total_paginas'] ?? 0),
            'monto_estimado' => (float) $calc['monto_total'],
            'advertencias' => $advertencias,
            'actual' => $actual,
        ];
    }

    /**
     * Inicio del ultimo ciclo cubierto por cualquier factura que toca el
     * contrato (conservadora por interseccion: el ultimo ciclo que alguna
     * factura toca). Null si ninguna factura toca un ciclo del contrato.
     *
     * @param  iterable<Invoice>  $facturas
     */
    private function ultimoPeriodoCubierto(Contract $contrato, $facturas): ?Carbon
    {
        $ultimoN = null;
        foreach ($facturas as $factura) {
            $n = CicloFacturacion::cicloQueContiene($contrato, $factura->periodo_fin->copy()->startOfDay());
            if ($n >= 0 && ($ultimoN === null || $n > $ultimoN)) {
                $ultimoN = $n;
            }
        }

        return $ultimoN === null ? null : CicloFacturacion::inicioDeCiclo($contrato, $ultimoN);
    }
}
