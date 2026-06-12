<?php

namespace App\Http\Controllers;

use App\Enums\InvoiceStatus;
use App\Enums\MaintenanceStatus;
use App\Enums\PrinterStatus;
use App\Enums\PurchaseStatus;
use App\Enums\VisitStatus;
use App\Models\Article;
use App\Models\Invoice;
use App\Models\MaintenanceOrder;
use App\Models\Printer;
use App\Models\Purchase;
use App\Models\Visit;
use App\Services\InvoiceService;
use App\Services\VisitSchedulerService;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        private InvoiceService $invoiceService,
        private VisitSchedulerService $visitScheduler
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $currentMonth = now()->startOfMonth();
        $lastMonth = now()->subMonth()->startOfMonth();

        $currentMonthRevenue = Invoice::where('estado', '!=', InvoiceStatus::INCOBRABLE)
            ->whereMonth('fecha_emision', now()->month)
            ->whereYear('fecha_emision', now()->year)
            ->sum('monto_total');

        $lastMonthRevenue = Invoice::where('estado', '!=', InvoiceStatus::INCOBRABLE)
            ->whereMonth('fecha_emision', $lastMonth->month)
            ->whereYear('fecha_emision', $lastMonth->year)
            ->sum('monto_total');

        $pendingInvoices = Invoice::whereIn('estado', [
            InvoiceStatus::PENDIENTE,
            InvoiceStatus::PARCIALMENTE_PAGADA,
        ])->count();

        $overdueInvoices = Invoice::where('estado', InvoiceStatus::VENCIDA)->count();

        $pendingVisits = Visit::where('estado', VisitStatus::PENDIENTE)
            ->whereMonth('fecha_programada', now()->month)
            ->count();

        $myPendingVisits = Visit::where('estado', VisitStatus::PENDIENTE)
            ->where('socio_id', $user->id)
            ->whereBetween('fecha_programada', [now(), now()->addDays(7)])
            ->count();

        $printersByStatus = Printer::without('history', 'maintenanceOrders')->selectRaw('estado, count(*) as total')
            ->groupBy('estado')
            ->pluck('total', 'estado');

        $outstandingBalance = $this->invoiceService->getOutstandingBalance();

        $upcomingAlerts = $this->visitScheduler->checkUpcomingAlerts();

        $lowStockCount = Article::active()
            ->whereColumn('stock_actual', '<=', 'umbral_reposicion')
            ->count();

        $inventoryValue = Article::active()
            ->selectRaw('SUM(stock_actual * costo_unitario) as total')
            ->value('total') ?? 0;

        $criticalStockCount = Article::active()
            ->where('stock_actual', 0)
            ->count();

        $pendingMaintenance = MaintenanceOrder::where('estado', MaintenanceStatus::PROGRAMADA)->count();

        $completedMaintenanceMonth = MaintenanceOrder::where('estado', MaintenanceStatus::COMPLETADA)
            ->whereMonth('fecha', now()->month)
            ->whereYear('fecha', now()->year)
            ->count();

        $printersInMaintenance = Printer::where('estado', PrinterStatus::EN_MANTENIMIENTO)->count();

        $pendingPurchasesOverdue = Purchase::where('estado', PurchaseStatus::RECIBIDA)
            ->where('saldo_pendiente', '>', 0)
            ->where('fecha_vto_pago', '<', now())
            ->count();

        $pendingPurchasesDueSoon = Purchase::where('estado', PurchaseStatus::RECIBIDA)
            ->where('saldo_pendiente', '>', 0)
            ->whereBetween('fecha_vto_pago', [now(), now()->addDays(7)])
            ->count();

        return response()->json([
            'kpis' => [
                'ingresos_mes' => $currentMonthRevenue,
                'ingresos_mes_anterior' => $lastMonthRevenue,
                'facturas_pendientes' => $pendingInvoices,
                'facturas_vencidas' => $overdueInvoices,
                'visitas_pendientes' => $pendingVisits,
                'mis_visitas_proximas' => $myPendingVisits,
                'saldo_pendiente_total' => $outstandingBalance,
                'stock_bajo' => $lowStockCount,
                'valor_inventario' => $inventoryValue,
                'stock_critico' => $criticalStockCount,
                'mantenimientos_pendientes' => $pendingMaintenance,
                'mantenimientos_completados_mes' => $completedMaintenanceMonth,
                'impresoras_en_mantenimiento' => $printersInMaintenance,
                'compras_vencidas' => $pendingPurchasesOverdue,
                'compras_por_vencer' => $pendingPurchasesDueSoon,
            ],
            'impresoras_por_estado' => $printersByStatus,
            'alertas' => [
                'facturas_vencidas' => Invoice::where('estado', InvoiceStatus::VENCIDA)
                    ->with('client')
                    ->limit(5)
                    ->get(),
                'visitas_proximas' => $upcomingAlerts,
                'articulos_stock_bajo' => Article::active()
                    ->whereColumn('stock_actual', '<=', 'umbral_reposicion')
                    ->with('supplier')
                    ->limit(10)
                    ->get(),
                'mantenimientos_pendientes' => MaintenanceOrder::where('estado', MaintenanceStatus::PROGRAMADA)
                    ->with(['printer', 'supplier'])
                    ->limit(5)
                    ->get(),
                'compras_por_vencer' => Purchase::where('estado', PurchaseStatus::RECIBIDA)
                    ->where('saldo_pendiente', '>', 0)
                    ->whereBetween('fecha_vto_pago', [now(), now()->addDays(7)])
                    ->with('supplier')
                    ->limit(5)
                    ->get(),
            ],
        ]);
    }
}
