<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\Purchase;
use App\Models\PrinterExpense;
use App\Models\SupplierPayment;
use Illuminate\Support\Carbon;

class CashFlowService
{
    public function getCashFlowSeries(int $meses = 6): array
    {
        $rangeStart = now()->subMonths($meses - 1)->startOfMonth();
        $rangeEnd = now()->copy()->endOfMonth();

        $ingresos = $this->sumByMonth(Payment::class, 'fecha', 'monto', $rangeStart, $rangeEnd);
        $egresosProveedores = $this->sumByMonth(SupplierPayment::class, 'fecha', 'monto', $rangeStart, $rangeEnd);
        $egresosImpresoras = $this->sumByMonth(PrinterExpense::class, 'fecha', 'monto', $rangeStart, $rangeEnd);
        $egresosCompras = $this->sumByMonth(Purchase::class, 'fecha', 'monto_total', $rangeStart, $rangeEnd);

        $results = [];
        $acumulado = 0.0;

        for ($i = $meses - 1; $i >= 0; $i--) {
            $month = now()->subMonths($i);
            $key = $month->format('Y-m');

            $ingreso = $ingresos[$key] ?? 0.0;
            $egreso = ($egresosProveedores[$key] ?? 0.0)
                + ($egresosImpresoras[$key] ?? 0.0)
                + ($egresosCompras[$key] ?? 0.0);

            $flujoNeto = $ingreso - $egreso;
            $acumulado += $flujoNeto;

            $results[] = [
                'mes' => $key,
                'mes_nombre' => $month->translatedFormat('F Y'),
                'ingresos' => (float) $ingreso,
                'egresos' => (float) $egreso,
                'flujo_neto' => (float) $flujoNeto,
                'acumulado' => (float) $acumulado,
            ];
        }

        return $results;
    }

    /**
     * Suma una columna agrupada por mes (YYYY-MM) en un rango de fechas,
     * usando una sola consulta por tabla en lugar de una por mes.
     *
     * @return array<string, float>
     */
    private function sumByMonth(string $model, string $dateColumn, string $sumColumn, Carbon $start, Carbon $end): array
    {
        return $model::whereBetween($dateColumn, [$start, $end])
            ->selectRaw("TO_CHAR({$dateColumn}, 'YYYY-MM') AS mes, SUM({$sumColumn}) AS total")
            ->groupByRaw("TO_CHAR({$dateColumn}, 'YYYY-MM')")
            ->pluck('total', 'mes')
            ->mapWithKeys(fn ($value, $key) => [(string) $key => (float) $value])
            ->all();
    }
}
