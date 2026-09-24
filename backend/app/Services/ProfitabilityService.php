<?php

namespace App\Services;

use App\Models\ArticleDelivery;
use App\Models\ContractPrinter;
use App\Models\MaintenanceOrder;
use App\Models\Printer;
use App\Models\PrinterExpense;
use App\Models\Reading;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProfitabilityService
{
    public function __construct(
        private TonerService $tonerService,
    ) {}

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

        // Páginas impresas en el rango por impresora (volumen del renglón;
        // una sola query batch).
        $paginas = Reading::whereIn('impresora_id', $printers->pluck('id')->all())
            ->whereBetween('fecha', [$periodoInicio, $periodoFin])
            ->selectRaw('impresora_id, SUM(paginas_periodo) AS total')
            ->groupBy('impresora_id')
            ->pluck('total', 'impresora_id')
            ->mapWithKeys(fn ($value, $key) => [(string) $key => (int) $value]);

        // Costo por página estimado con insumo (largo plazo, sin rango): el
        // costo tóner no es de caja del periodo, es la métrica estimativa
        // derivada de entregas + niveles (TonerService, D1: nunca cobro).
        $costoTonerPorPagina = $this->tonerService->costoTonerPorPaginaPorImpresora($printers->pluck('id')->all());

        $results = [];

        foreach ($printers as $printer) {
            $key = (string) $printer->id;
            $ingreso = $ingresos[$key] ?? 0.0;
            $gastos = (float) ($costos[$key]['gastos'] ?? 0.0);
            $mantenimiento = (float) ($costos[$key]['mantenimiento'] ?? 0.0);
            $insumosToner = (float) ($costos[$key]['insumos_toner'] ?? 0.0);
            $costo = $gastos + $mantenimiento + $insumosToner;
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
                'gastos' => $gastos,
                'mantenimiento' => $mantenimiento,
                'insumos_toner' => $insumosToner,
                'costos' => (float) $costo,
                'margen' => (float) $margen,
                'roi' => $roi !== null ? (float) $roi : null,
                'paginas_periodo' => $paginas[$key] ?? 0,
                'costo_toner_por_pagina' => $costoTonerPorPagina[$key]['costo_toner_por_pagina'] ?? null,
            ];
        }

        return $results;
    }

    /**
     * Costos (gastos + mantenimiento + insumos de tóner) agregados por
     * impresora para un conjunto de impresoras y un rango de fechas. Fuente
     * unica de la definicion de costos, compartida por rentabilidad por
     * impresora y por cliente.
     *
     * Insumos de tóner: Σ subtotal de las entregas TONER del rango (snapshot
     * de costo de la entrega, D3) atribuidas por contrato y repartidas
     * parejo entre las impresoras con pivot activa presentes en $printerIds.
     * A nivel contrato/cliente el agregado es exacto (la entrega vive a
     * nivel contrato); por renglón es un reparto, mientras que los ingresos
     * usan la convención D19 de monto completo a cada activa — convenciones
     * mixtas en contratos multi-impresora, deuda documentada.
     *
     * @param  array<int, int|string>  $printerIds
     * @return array<string, array{gastos: float, mantenimiento: float, insumos_toner: float}>
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

        $insumos = $this->insumosTonerPorImpresora($printerIds, $inicio, $fin);

        $result = [];
        foreach ($printerIds as $id) {
            $key = (string) $id;
            $result[$key] = [
                'gastos' => $gastos[$key] ?? 0.0,
                'mantenimiento' => $mantenimiento[$key] ?? 0.0,
                'insumos_toner' => (float) ($insumos[$key] ?? 0.0),
            ];
        }

        return $result;
    }

    /**
     * Costo total (gastos + mantenimiento + insumos de tóner) para un
     * conjunto de impresoras. Atajo para reportes que solo necesitan el
     * agregado (p. ej. rentabilidad por cliente).
     *
     * @param  array<int, int|string>  $printerIds
     */
    public function totalCostForPrinters(array $printerIds, string $inicio, string $fin): float
    {
        if (empty($printerIds)) {
            return 0.0;
        }

        return Collection::make($this->costByPrinter($printerIds, $inicio, $fin))
            ->sum(fn (array $costo) => $costo['gastos'] + $costo['mantenimiento'] + $costo['insumos_toner']);
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

    /**
     * Insumos de tóner del rango por impresora: Σ subtotal de las entregas
     * TONER agregadas por contrato, repartido parejo entre las impresoras
     * con pivot activa presentes en $printerIds (los shares de un contrato
     * suman su total). Contratos sin pivotes activos quedan fuera (caso
     * histórico raro, limitación documentada).
     *
     * @param  array<int, int|string>  $printerIds
     * @return array<string, float>
     */
    private function insumosTonerPorImpresora(array $printerIds, string $inicio, string $fin): array
    {
        $pivots = ContractPrinter::whereIn('impresora_id', $printerIds)
            ->where('activa', true)
            ->get(['contrato_id', 'impresora_id']);

        if ($pivots->isEmpty()) {
            return [];
        }

        // DATE(fecha_creacion): la entrega guarda timestamp; sin el cast, las
        // del último día del rango (con hora) quedarían fuera del corte.
        $entregasPorContrato = ArticleDelivery::query()
            ->whereIn('contrato_id', $pivots->pluck('contrato_id')->unique()->values()->all())
            ->whereHas('article', fn ($q) => $q->where('subtipo', 'TONER'))
            ->whereBetween(DB::raw('DATE(fecha_creacion)'), [$inicio, $fin])
            ->groupBy('contrato_id')
            ->selectRaw('contrato_id, SUM(subtotal) AS total')
            ->pluck('total', 'contrato_id');

        $insumos = [];

        foreach ($pivots->groupBy('contrato_id') as $contratoId => $delContrato) {
            $total = (float) ($entregasPorContrato->get($contratoId) ?? 0);

            if ($total <= 0.0) {
                continue;
            }

            $porImpresora = $total / $delContrato->count();

            foreach ($delContrato as $pivot) {
                $key = (string) $pivot->impresora_id;
                $insumos[$key] = ($insumos[$key] ?? 0.0) + $porImpresora;
            }
        }

        return $insumos;
    }
}
