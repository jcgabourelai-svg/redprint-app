<?php

namespace App\Services;

use App\Enums\ContractStatus;
use App\Models\Contract;
use App\Models\Invoice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Estado de facturación de un contrato: periodos mensuales (D17) ya
 * facturados vs pendientes, con estimación por mes.
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
            ->sortByDesc(fn (Invoice $f) => $f->periodo_inicio->format('Y-m'))
            ->values()
            ->map(fn (Invoice $f) => [
                'factura_id' => (int) $f->id,
                'numero_factura' => $f->numero_factura,
                'estado' => $f->estado->value,
                'periodo_inicio' => $f->periodo_inicio->toDateString(),
                'periodo_fin' => $f->periodo_fin->toDateString(),
                'periodo' => $f->periodo_inicio->format('Y-m'),
                'monto_contrato' => round((float) ($montosPorFactura[$f->id] ?? 0), 2),
                'monto_total' => (float) $f->monto_total,
            ])
            ->all();

        return [
            'facturados' => $facturados,
            'pendientes' => $this->periodosPendientes($contrato, $facturas),
            'ultimo_periodo_cubierto' => $this->ultimoPeriodoCubierto($facturas)?->format('Y-m'),
        ];
    }

    /**
     * Regla de cobertura (conservadora por intersección): facturas del
     * cliente que tocan el contrato por encabezado (mono-contrato) o por
     * detalles (multi-contrato). Incluye borradores: también reservan.
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
     * Meses pendientes según reglas 2/3: desde max(mes de fecha_inicio, mes
     * siguiente al último cubierto) hasta el mes actual (o el mes de
     * fecha_fin si el contrato FINALIZÓ). CANCELADO/SUSPENDIDO no generan.
     * Tope de 24 meses (mismo límite que el batch; acota el loop de cálculo).
     *
     * @param  iterable<Invoice>  $facturas
     * @return array<int, array{periodo: string, periodo_inicio: string, periodo_fin: string, lecturas: int, paginas: int, monto_estimado: float, advertencias: string[], actual: bool}>
     */
    private function periodosPendientes(Contract $contrato, $facturas): array
    {
        if (in_array($contrato->estado, [ContractStatus::CANCELADO, ContractStatus::SUSPENDIDO], true)) {
            return [];
        }

        $hoy = Carbon::now()->startOfMonth();

        $fin = $hoy->copy();
        if ($contrato->estado === ContractStatus::FINALIZADO) {
            if ($contrato->fecha_fin === null) {
                return [];
            }
            $finContrato = $contrato->fecha_fin->copy()->startOfMonth();
            if ($finContrato->lt($fin)) {
                $fin = $finContrato;
            }
        }

        $primerPendiente = $contrato->fecha_inicio->copy()->startOfMonth();
        $ultimoCubierto = $this->ultimoPeriodoCubierto($facturas);
        if ($ultimoCubierto !== null && $ultimoCubierto->copy()->addMonth()->gt($primerPendiente)) {
            $primerPendiente = $ultimoCubierto->copy()->addMonth();
        }

        $pendientes = [];
        $mes = $primerPendiente->copy();
        while ($mes->lte($fin) && count($pendientes) < 24) {
            $pendientes[] = $this->estimadoDelMes($contrato, $mes, $hoy);
            $mes->addMonth();
        }

        return $pendientes;
    }

    /**
     * Estimación de un mes pendiente reutilizando el motor de cálculo
     * limitado al contrato. Bounds recortados a la vigencia (regla 3).
     *
     * @return array{periodo: string, periodo_inicio: string, periodo_fin: string, lecturas: int, paginas: int, monto_estimado: float, advertencias: string[], actual: bool}
     */
    private function estimadoDelMes(Contract $contrato, Carbon $mes, Carbon $mesActual): array
    {
        $periodoInicio = $mes->copy()->startOfMonth();
        $inicioContrato = $contrato->fecha_inicio->copy()->startOfDay();
        if ($inicioContrato->gt($periodoInicio)) {
            $periodoInicio = $inicioContrato;
        }

        $periodoFin = $mes->copy()->endOfMonth();
        if ($contrato->fecha_fin !== null) {
            $finContrato = $contrato->fecha_fin->copy()->endOfDay();
            if ($finContrato->lt($periodoFin)) {
                $periodoFin = $finContrato;
            }
        }

        $calc = $this->calculationService->calcularEstimacion(
            (int) $contrato->cliente_id,
            $periodoInicio->toDateString(),
            $periodoFin->toDateString(),
            null,
            (int) $contrato->id,
            // Los pendientes de contratos no ACTIVO (FINALIZADO) son
            // informativos: la guarda de facturabilidad no aplica aqui.
            false,
        );

        // El detector de solapamiento del motor es a nivel cliente: para los
        // pendientes (por definición no cubiertos para ESTE contrato) las
        // advertencias de solape con otros contratos son ruido.
        $advertencias = array_values(array_filter(
            $calc['advertencias'],
            fn (string $a) => !str_contains($a, 'se solapa'),
        ));

        $actual = $mes->equalTo($mesActual);
        if ($actual) {
            $advertencias[] = 'Periodo en curso: las lecturas del mes aún están incompletas.';
        }

        return [
            'periodo' => $mes->format('Y-m'),
            'periodo_inicio' => $periodoInicio->toDateString(),
            'periodo_fin' => $periodoFin->toDateString(),
            'lecturas' => collect($calc['detalles'])->filter(fn ($d) => !empty($d['lectura_id']))->count(),
            'paginas' => (int) ($calc['contratos'][0]['total_paginas'] ?? 0),
            'monto_estimado' => (float) $calc['monto_total'],
            'advertencias' => $advertencias,
            'actual' => $actual,
        ];
    }

    /**
     * Último mes cubierto por cualquier factura que toca el contrato (el
     * rango de una factura cubre todos los meses que intersecta).
     *
     * @param  iterable<Invoice>  $facturas
     */
    private function ultimoPeriodoCubierto($facturas): ?Carbon
    {
        $ultimo = null;
        foreach ($facturas as $factura) {
            $mesFin = $factura->periodo_fin->copy()->startOfMonth();
            if ($ultimo === null || $mesFin->gt($ultimo)) {
                $ultimo = $mesFin;
            }
        }

        return $ultimo;
    }
}
