<?php

namespace App\Services;

use App\Models\MaintenanceOrder;
use App\Models\Printer;
use App\Models\PrinterExpense;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProfitabilityService
{
    public function perPrinter(?string $inicio, ?string $fin, ?int $printerId = null): array
    {
        $periodoInicio = $inicio ?? now()->startOfMonth()->toDateString();
        $periodoFin = $fin ?? now()->endOfMonth()->toDateString();

        $query = Printer::query();

        if ($printerId !== null) {
            $query->where('id', $printerId);
        }

        $printers = $query->get(['id', 'marca', 'modelo', 'codigo_negocio', 'costo_adquisicion']);

        if ($printers->isEmpty()) {
            return [];
        }

        /**
         * Ingresos atribuidos por impresora desde invoice_details (D19):
         * SUM(monto_calculado) de los detalles de cada contrato, filtrado por
         * el periodo de la factura y sin BORRADORES (aún no son CxC).
         *
         * Nota semántica: pasa de monto_total por encabezado a atribuido por
         * detalles. Limitaciones pre-existentes que se conservan: solo se
         * joinea contract_printer con activa = true (impresoras liberadas no
         * atribuyen) y cada impresora activa del contrato le atribuye el
         * monto completo de los detalles de ese contrato (no se reparte entre
         * equipos).
         */
        $ingresos = DB::table('invoice_details')
            ->join('invoices', 'invoice_details.factura_id', '=', 'invoices.id')
            ->join('contract_printer', 'invoice_details.contrato_id', '=', 'contract_printer.contrato_id')
            ->where('contract_printer.activa', true)
            ->where('invoices.estado', '!=', 'BORRADOR')
            ->whereBetween('invoices.periodo_inicio', [$periodoInicio, $periodoFin])
            ->selectRaw('contract_printer.impresora_id, SUM(invoice_details.monto_calculado) AS total')
            ->groupBy('contract_printer.impresora_id')
            ->pluck('total', 'impresora_id')
            ->mapWithKeys(fn ($value, $key) => [(string) $key => (float) $value]);

        $costos = $this->costByPrinter($printers->pluck('id')->all(), $periodoInicio, $periodoFin);

        $results = [];

        foreach ($printers as $printer) {
            $key = (string) $printer->id;
            $ingreso = $ingresos[$key] ?? 0.0;
            $costo = ($costos[$key]['gastos'] ?? 0.0) + ($costos[$key]['mantenimiento'] ?? 0.0);
            $margen = $ingreso - $costo;

            $roi = null;
            if ($printer->costo_adquisicion > 0) {
                $roi = ($margen / $printer->costo_adquisicion) * 100;
            }

            $results[] = [
                'impresora_id' => $printer->id,
                'marca' => $printer->marca,
                'modelo' => $printer->modelo,
                'codigo_negocio' => $printer->codigo_negocio,
                'ingresos' => (float) $ingreso,
                'costos' => (float) $costo,
                'margen' => (float) $margen,
                'roi' => $roi !== null ? (float) $roi : null,
            ];
        }

        return $results;
    }

    /**
     * Costos (gastos + mantenimiento) agregados por impresora para un conjunto
     * de impresoras y un rango de fechas. Fuente unica de la definicion de costos,
     * compartida por rentabilidad por impresora y por cliente.
     *
     * @param  array<int, int|string>  $printerIds
     * @return array<string, array{gastos: float, mantenimiento: float}>
     */
    public function costByPrinter(array $printerIds, string $inicio, string $fin): array
    {
        if (empty($printerIds)) {
            return [];
        }

        $gastos = PrinterExpense::whereIn('impresora_id', $printerIds)
            ->whereBetween('fecha', [$inicio, $fin])
            ->selectRaw('impresora_id, SUM(monto) AS total')
            ->groupBy('impresora_id')
            ->pluck('total', 'impresora_id')
            ->mapWithKeys(fn ($value, $key) => [(string) $key => (float) $value]);

        $mantenimiento = MaintenanceOrder::whereIn('impresora_id', $printerIds)
            ->whereBetween('fecha', [$inicio, $fin])
            ->selectRaw('impresora_id, SUM(costo_total) AS total')
            ->groupBy('impresora_id')
            ->pluck('total', 'impresora_id')
            ->mapWithKeys(fn ($value, $key) => [(string) $key => (float) $value]);

        $result = [];
        foreach ($printerIds as $id) {
            $key = (string) $id;
            $result[$key] = [
                'gastos' => $gastos[$key] ?? 0.0,
                'mantenimiento' => $mantenimiento[$key] ?? 0.0,
            ];
        }

        return $result;
    }

    /**
     * Costo total (gastos + mantenimiento) para un conjunto de impresoras.
     * Atajo para reportes que solo necesitan el agregado (p. ej. rentabilidad por cliente).
     *
     * @param  array<int, int|string>  $printerIds
     */
    public function totalCostForPrinters(array $printerIds, string $inicio, string $fin): float
    {
        if (empty($printerIds)) {
            return 0.0;
        }

        return Collection::make($this->costByPrinter($printerIds, $inicio, $fin))
            ->sum(fn (array $costo) => $costo['gastos'] + $costo['mantenimiento']);
    }

    public function topByMargin(int $limit = 5, ?string $inicio = null, ?string $fin = null): array
    {
        $results = $this->perPrinter($inicio, $fin);

        return Collection::make($results)
            ->sortByDesc('margen')
            ->take($limit)
            ->values()
            ->toArray();
    }
}
