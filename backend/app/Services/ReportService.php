<?php

namespace App\Services;

use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use App\Models\Article;
use App\Models\MaintenanceOrder;
use App\Models\Purchase;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function getMaintenanceProviderMetrics(): array
    {
        return MaintenanceOrder::where('estado', MaintenanceStatus::COMPLETADA)
            ->whereNotNull('proveedor_id')
            ->with('supplier')
            ->select('proveedor_id')
            ->selectRaw('COUNT(*) as total_ordenes')
            ->selectRaw('AVG(costo_total) as costo_promedio')
            ->selectRaw('SUM(costo_total) as costo_total')
            ->selectRaw('AVG(EXTRACT(EPOCH FROM (updated_at - fecha)) / 86400) as dias_promedio_resolucion')
            ->groupBy('proveedor_id')
            ->get()
            ->map(function ($item) {
                return [
                    'proveedor_id' => $item->proveedor_id,
                    'proveedor' => $item->supplier?->razon_social,
                    'total_ordenes' => $item->total_ordenes,
                    'costo_promedio' => round((float) $item->costo_promedio, 2),
                    'costo_total' => round((float) $item->costo_total, 2),
                    'dias_promedio_resolucion' => round((float) $item->dias_promedio_resolucion, 1),
                ];
            })
            ->toArray();
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
