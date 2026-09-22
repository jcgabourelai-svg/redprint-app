<?php

namespace App\Services;

use App\Enums\ArticleType;
use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use App\Models\Article;
use App\Models\ArticleUsed;
use App\Models\MaintenanceOrder;
use App\Models\Purchase;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * KPIs del módulo de mantenimiento. Mantiene las 4 claves históricas
     * (abiertas, completadas_mes, costo_mes, pct_correctivas) para no romper
     * la UI y añade desgloses por socio, tipo de problema, tipo de orden y
     * MTTR. Sin rango explícito usa el mes corriente (backward compatible).
     */
    public function getMaintenanceStats(array $params = []): array
    {
        $desde = $params['fecha_desde'] ?? now()->startOfMonth()->toDateString();
        $hasta = $params['fecha_hasta'] ?? now()->toDateString();

        $completadas = MaintenanceOrder::query()
            ->where('estado', MaintenanceStatus::COMPLETADA)
            ->where('fecha_completado', '>=', $desde)
            ->where('fecha_completado', '<=', $hasta . ' 23:59:59');

        $abiertas = MaintenanceOrder::query()
            ->where('estado', MaintenanceStatus::PROGRAMADA);

        if (!empty($params['socio_id'])) {
            $completadas->where('socio_id', $params['socio_id']);
            $abiertas->where('socio_id', $params['socio_id']);
        }

        $total = (clone $completadas)->count();
        $correctivas = (clone $completadas)
            ->where('tipo_mantto', MaintenanceType::CORRECTIVO)
            ->count();

        $porSocio = (clone $completadas)
            ->join('users', 'users.id', '=', 'maintenance_orders.socio_id')
            ->select('maintenance_orders.socio_id')
            ->selectRaw('users.nombre as nombre')
            ->selectRaw('COUNT(*) as completadas')
            ->selectRaw('SUM(maintenance_orders.costo_total) as costo_manejado')
            ->groupBy('maintenance_orders.socio_id', 'users.nombre')
            ->orderByDesc('completadas')
            ->get()
            ->map(fn ($row) => [
                'socio_id' => (int) $row->socio_id,
                'nombre' => $row->nombre,
                'completadas' => (int) $row->completadas,
                'costo_manejado' => round((float) $row->costo_manejado, 2),
            ])
            ->toArray();

        $porTipoProblema = (clone $completadas)
            ->where('tipo_mantto', MaintenanceType::CORRECTIVO)
            ->select('tipo_problema')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(costo_total) as costo_total')
            ->groupBy('tipo_problema')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'tipo_problema' => $row->tipo_problema?->value ?? 'SIN_CLASIFICAR',
                'total' => (int) $row->total,
                'costo_total' => round((float) $row->costo_total, 2),
            ])
            ->toArray();

        $porTipoManttoRows = (clone $completadas)
            ->select('tipo_mantto')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('tipo_mantto')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->tipo_mantto->value => (int) $row->total]);

        $mttrDias = (clone $completadas)
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (fecha_completado - fecha_creacion)) / 86400) as mttr')
            ->value('mttr');

        return [
            'abiertas' => $abiertas->count(),
            'completadas_mes' => $total,
            'costo_mes' => (float) (clone $completadas)->sum('costo_total'),
            'pct_correctivas' => $total > 0 ? round($correctivas * 100 / $total, 1) : 0,
            'por_socio' => $porSocio,
            'por_tipo_problema' => $porTipoProblema,
            'por_tipo_mantto' => [
                'PREVENTIVO' => (int) ($porTipoManttoRows['PREVENTIVO'] ?? 0),
                'CORRECTIVO' => (int) ($porTipoManttoRows['CORRECTIVO'] ?? 0),
            ],
            'mttr_dias' => $mttrDias !== null ? round((float) $mttrDias, 1) : 0,
        ];
    }

    /**
     * Piezas e insumos más usados en órdenes COMPLETADAS (por fecha de
     * completado). Agrega cantidad y costo por artículo; opcionalmente
     * filtra por tipo de artículo (CONSUMIBLE|REPARACION).
     */
    public function getTopUsedArticles(?string $desde = null, ?string $hasta = null, ?string $tipoArticulo = null, int $limit = 20): array
    {
        return ArticleUsed::query()
            ->join('articles', 'articles.id', '=', 'articles_used.articulo_id')
            ->join('maintenance_orders', 'maintenance_orders.id', '=', 'articles_used.orden_mantto_id')
            ->where('maintenance_orders.estado', MaintenanceStatus::COMPLETADA)
            ->when($desde, fn ($q) => $q->where('maintenance_orders.fecha_completado', '>=', $desde))
            ->when($hasta, fn ($q) => $q->where('maintenance_orders.fecha_completado', '<=', $hasta . ' 23:59:59'))
            ->when($tipoArticulo, fn ($q) => $q->where('articles.tipo_articulo', $tipoArticulo))
            ->select('articles_used.articulo_id')
            ->selectRaw('articles.nombre as nombre')
            ->selectRaw('articles.tipo_articulo as tipo_articulo')
            ->selectRaw('SUM(articles_used.cantidad) as total_cantidad')
            ->selectRaw('SUM(articles_used.subtotal) as total_costo')
            ->groupBy('articles_used.articulo_id', 'articles.nombre', 'articles.tipo_articulo')
            ->orderByDesc('total_costo')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => [
                'articulo_id' => (int) $row->articulo_id,
                'nombre' => $row->nombre,
                'tipo_articulo' => $row->tipo_articulo instanceof ArticleType ? $row->tipo_articulo->value : $row->tipo_articulo,
                'total_cantidad' => (int) $row->total_cantidad,
                'total_costo' => round((float) $row->total_costo, 2),
            ])
            ->toArray();
    }

    /**
     * Ranking de fallas: correctivas completadas agrupadas por tipo de
     * problema × modelo de impresora, con las piezas más consumidas por
     * cada tipo de falla (top 3 por costo).
     */
    public function getFailureRanking(?string $desde = null, ?string $hasta = null): array
    {
        $base = MaintenanceOrder::query()
            ->where('maintenance_orders.estado', MaintenanceStatus::COMPLETADA)
            ->where('maintenance_orders.tipo_mantto', MaintenanceType::CORRECTIVO)
            ->when($desde, fn ($q) => $q->where('maintenance_orders.fecha_completado', '>=', $desde))
            ->when($hasta, fn ($q) => $q->where('maintenance_orders.fecha_completado', '<=', $hasta . ' 23:59:59'));

        $ranking = (clone $base)
            ->join('printers', 'printers.id', '=', 'maintenance_orders.impresora_id')
            ->select('maintenance_orders.tipo_problema')
            ->selectRaw('printers.printer_model_id as modelo_id')
            ->selectRaw('printers.marca as marca')
            ->selectRaw('printers.modelo as modelo')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(maintenance_orders.costo_total) as costo_total')
            ->groupBy('maintenance_orders.tipo_problema', 'printers.printer_model_id', 'printers.marca', 'printers.modelo')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'tipo_problema' => $row->tipo_problema?->value ?? 'SIN_CLASIFICAR',
                'modelo_id' => $row->modelo_id,
                'marca' => $row->marca,
                'modelo' => $row->modelo,
                'total' => (int) $row->total,
                'costo_total' => round((float) $row->costo_total, 2),
            ])
            ->toArray();

        $piezasAsociadas = (clone $base)
            ->join('articles_used', 'articles_used.orden_mantto_id', '=', 'maintenance_orders.id')
            ->join('articles', 'articles.id', '=', 'articles_used.articulo_id')
            ->select('maintenance_orders.tipo_problema')
            ->selectRaw('articles_used.articulo_id')
            ->selectRaw('articles.nombre as nombre')
            ->selectRaw('SUM(articles_used.cantidad) as total_cantidad')
            ->selectRaw('SUM(articles_used.subtotal) as total_costo')
            ->groupBy('maintenance_orders.tipo_problema', 'articles_used.articulo_id', 'articles.nombre')
            ->orderByDesc('total_costo')
            ->get()
            ->groupBy(fn ($row) => $row->tipo_problema?->value ?? 'SIN_CLASIFICAR')
            ->map(fn ($rows) => $rows->take(3)->map(fn ($row) => [
                'articulo_id' => (int) $row->articulo_id,
                'nombre' => $row->nombre,
                'total_cantidad' => (int) $row->total_cantidad,
                'total_costo' => round((float) $row->total_costo, 2),
            ])->values()->toArray())
            ->toArray();

        return [
            'ranking' => $ranking,
            'piezas_asociadas' => $piezasAsociadas,
        ];
    }

    public function getProblematicPrinters(int $limit = 10): array
    {
        return MaintenanceOrder::where('estado', MaintenanceStatus::COMPLETADA)
            ->with('printer')
            ->select('impresora_id')
            ->selectRaw('COUNT(*) as total_mantenimientos')
            ->selectRaw('SUM(costo_total) as costo_total_mantenimiento')
            ->selectRaw('AVG(costo_total) as costo_promedio')
            ->groupBy('impresora_id')
            ->orderByDesc('total_mantenimientos')
            ->limit($limit)
            ->get()
            ->map(function ($item) {
                $item->printer?->load('warehouse');
                return [
                    'impresora_id' => $item->impresora_id,
                    'impresora_codigo' => $item->printer?->codigo_negocio,
                    'impresora_marca' => $item->printer?->marca,
                    'impresora_modelo' => $item->printer?->modelo,
                    'total_mantenimientos' => $item->total_mantenimientos,
                    'costo_total' => round((float) $item->costo_total_mantenimiento, 2),
                    'costo_promedio' => round((float) $item->costo_promedio, 2),
                ];
            })
            ->toArray();
    }

    public function getPrinterMaintenanceCost(int $printerId): array
    {
        $orders = MaintenanceOrder::where('impresora_id', $printerId)
            ->where('estado', MaintenanceStatus::COMPLETADA)
            ->get();

        $expenses = \App\Models\PrinterExpense::where('impresora_id', $printerId)->get();

        $totalMantenimiento = $orders->sum('costo_total');
        $totalGastos = $expenses->sum('monto');
        $totalGeneral = (float) $totalMantenimiento + (float) $totalGastos;

        return [
            'impresora_id' => $printerId,
            'total_mantenimientos' => $orders->count(),
            'costo_mantenimiento' => round((float) $totalMantenimiento, 2),
            'costo_gastos' => round((float) $totalGastos, 2),
            'costo_total' => round($totalGeneral, 2),
            'costo_promedio_por_orden' => $orders->count() > 0
                ? round((float) $totalMantenimiento / $orders->count(), 2)
                : 0,
            'desglose_mensual' => $orders->groupBy(function ($order) {
                return $order->fecha->format('Y-m');
            })->map(function ($monthOrders) {
                return round((float) $monthOrders->sum('costo_total'), 2);
            })->toArray(),
        ];
    }

    public function getInventoryValue(): array
    {
        $articles = Article::with('supplier')->active()->get();

        $byType = $articles->groupBy('tipo_articulo')->map(function ($group) {
            return [
                'total_articulos' => $group->count(),
                'valor_total' => round($group->sum(fn($a) => $a->stock_actual * (float) $a->costo_unitario), 2),
            ];
        });

        return [
            'valor_total' => round($articles->sum(fn($a) => $a->stock_actual * (float) $a->costo_unitario), 2),
            'total_articulos' => $articles->count(),
            'por_tipo' => $byType,
            'articulos_bajo_umbral' => $articles->filter(fn($a) => $a->isLowStock())->count(),
            'costo_reposicion_estimado' => round($articles->filter(fn($a) => $a->isLowStock())->sum(fn($a) => ($a->umbral_reposicion - $a->stock_actual) * (float) $a->costo_unitario), 2),
        ];
    }

    public function getLowStockReport()
    {
        return Article::with('supplier')
            ->active()
            ->whereColumn('stock_actual', '<=', 'umbral_reposicion')
            ->orderBy('stock_actual', 'asc')
            ->get();
    }

    public function getSupplierReport(): array
    {
        return Purchase::with('supplier')
            ->select('proveedor_id')
            ->selectRaw('COUNT(*) as total_compras')
            ->selectRaw('SUM(monto_total) as monto_total')
            ->selectRaw('SUM(saldo_pendiente) as saldo_pendiente_total')
            ->groupBy('proveedor_id')
            ->get()
            ->map(function ($item) {
                return [
                    'proveedor_id' => $item->proveedor_id,
                    'proveedor' => $item->supplier?->razon_social,
                    'total_compras' => $item->total_compras,
                    'monto_total' => round((float) $item->monto_total, 2),
                    'saldo_pendiente' => round((float) $item->saldo_pendiente_total, 2),
                ];
            })
            ->toArray();
    }
}
