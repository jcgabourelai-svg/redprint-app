<?php

namespace App\Http\Controllers;

use App\Enums\InvoiceStatus;
use App\Enums\MaintenanceStatus;
use App\Enums\PrinterStatus;
use App\Enums\PurchaseStatus;
use App\Enums\VisitStatus;
use App\Models\Article;
use App\Models\FieldRecord;
use App\Models\Invoice;
use App\Models\MaintenanceOrder;
use App\Models\Printer;
use App\Models\Purchase;
use App\Models\Reading;
use App\Models\Visit;
use App\Services\CashFlowService;
use App\Services\InvoiceService;
use App\Services\ProfitabilityService;
use App\Services\VisitSchedulerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DashboardController extends Controller
{
    public function __construct(
        private InvoiceService $invoiceService,
        private VisitSchedulerService $visitScheduler,
        private CashFlowService $cashFlowService,
        private ProfitabilityService $profitabilityService,
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $ingresos6m = $this->buildIngresosSeries(6);
        $currentMonthRevenue = $ingresos6m[count($ingresos6m) - 1]['total'] ?? 0;
        $lastMonthRevenue = $ingresos6m[count($ingresos6m) - 2]['total'] ?? 0;

        $tendenciaIngresosPct = ($lastMonthRevenue > 0)
            ? round(($currentMonthRevenue / $lastMonthRevenue - 1) * 100, 1)
            : null;

        $paginasImpresasMes = (int) Reading::whereBetween('fecha', [
            now()->startOfMonth(),
            now()->endOfMonth(),
        ])->sum('paginas_periodo');

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

        $fieldRecordsPendientes = FieldRecord::where('estado', \App\Enums\FieldRecordStatus::PENDIENTE)->count();

        $mesActual = now()->format('Y-m');
        $flujoCaja6m = Cache::remember(
            "dashboard.flujo_caja.6",
            now()->addMinutes(5),
            fn () => $this->cashFlowService->getCashFlowSeries(6),
        );

        $topRentabilidad = Cache::remember(
            "dashboard.top_rentabilidad.{$mesActual}",
            now()->addMinutes(5),
            fn () => $this->profitabilityService->topByMargin(
                5,
                now()->startOfMonth()->toDateString(),
                now()->endOfMonth()->toDateString(),
            ),
        );

        return response()->json([
            'kpis' => [
                'ingresos_mes' => $currentMonthRevenue,
                'ingresos_mes_anterior' => $lastMonthRevenue,
                'tendencia_ingresos_pct' => $tendenciaIngresosPct,
                'facturas_pendientes' => $pendingInvoices,
                'facturas_vencidas' => $overdueInvoices,
                'visitas_pendientes' => $pendingVisits,
                'mis_visitas_proximas' => $myPendingVisits,
                'paginas_impresas_mes' => $paginasImpresasMes,
                'saldo_pendiente_total' => $outstandingBalance,
                'stock_bajo' => $lowStockCount,
                'valor_inventario' => $inventoryValue,
                'stock_critico' => $criticalStockCount,
                'mantenimientos_pendientes' => $pendingMaintenance,
                'mantenimientos_completados_mes' => $completedMaintenanceMonth,
                'impresoras_en_mantenimiento' => $printersInMaintenance,
                'compras_vencidas' => $pendingPurchasesOverdue,
                'compras_por_vencer' => $pendingPurchasesDueSoon,
                'registros_campo_pendientes' => $fieldRecordsPendientes,
            ],
            'impresoras_por_estado' => $printersByStatus,
            'series' => [
                'ingresos_6m' => $ingresos6m,
                'flujo_caja_6m' => $flujoCaja6m,
                'top_rentabilidad' => $topRentabilidad,
            ],
            'alertas' => [
                'facturas_vencidas' => Invoice::where('estado', InvoiceStatus::VENCIDA)
                    ->with('client')
                    ->select(['id', 'cliente_id', 'numero_factura', 'saldo_pendiente', 'fecha_vencimiento'])
                    ->orderBy('fecha_vencimiento')
                    ->limit(5)
                    ->get(),
                'visitas_proximas' => $upcomingAlerts,
                'articulos_stock_bajo' => Article::active()
                    ->whereColumn('stock_actual', '<=', 'umbral_reposicion')
                    ->with('supplier')
                    ->limit(10)
                    ->get(),
                'mantenimientos_pendientes' => MaintenanceOrder::where('estado', MaintenanceStatus::PROGRAMADA)
                    ->with(['printer'])
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

    /**
     * Serie de ingresos mensuales (no incobrables) de los ultimos N meses.
     * Una sola consulta agrupada por mes; sirve como fuente unica para la
     * tendencia del KPI y para la grafica de ingresos.
     *
     * @return array<int, array{mes: string, mes_nombre: string, total: float}>
     */
    private function buildIngresosSeries(int $meses): array
    {
        $rangeStart = now()->subMonths($meses - 1)->startOfMonth();
        $rangeEnd = now()->copy()->endOfMonth();

        $porMes = Invoice::where('estado', '!=', InvoiceStatus::INCOBRABLE)
            ->whereBetween('fecha_emision', [$rangeStart, $rangeEnd])
            ->selectRaw("TO_CHAR(fecha_emision, 'YYYY-MM') AS mes, SUM(monto_total) AS total")
            ->groupByRaw("TO_CHAR(fecha_emision, 'YYYY-MM')")
            ->pluck('total', 'mes')
            ->mapWithKeys(fn ($value, $key) => [(string) $key => (float) $value]);

        $series = [];
        for ($i = $meses - 1; $i >= 0; $i--) {
            $month = now()->subMonths($i);
            $key = $month->format('Y-m');

            $series[] = [
                'mes' => $key,
                'mes_nombre' => $month->translatedFormat('F Y'),
                'total' => $porMes[$key] ?? 0.0,
            ];
        }

        return $series;
    }
}
