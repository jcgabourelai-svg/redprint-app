<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\ContractPrinter;
use App\Services\CashFlowService;
use App\Services\ProfitabilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinanceReportController extends Controller
{
    public function __construct(
        private ProfitabilityService $profitabilityService,
        private CashFlowService $cashFlowService,
    ) {}

    public function profitability(Request $request)
    {
        $validated = $request->validate([
            'periodo_inicio' => 'nullable|date',
            'periodo_fin' => 'nullable|date|after_or_equal:periodo_inicio',
            'printer_id' => 'nullable|exists:printers,id',
        ]);

        $results = $this->profitabilityService->perPrinter(
            $validated['periodo_inicio'] ?? null,
            $validated['periodo_fin'] ?? null,
            isset($validated['printer_id']) ? (int) $validated['printer_id'] : null,
        );

        return response()->json($results);
    }

    public function clientProfitability(Request $request)
    {
        $validated = $request->validate([
            'periodo_inicio' => 'nullable|date',
            'periodo_fin' => 'nullable|date|after_or_equal:periodo_inicio',
            'cliente_id' => 'nullable|exists:clients,id',
        ]);

        $periodoInicio = $validated['periodo_inicio'] ?? now()->startOfMonth()->toDateString();
        $periodoFin = $validated['periodo_fin'] ?? now()->endOfMonth()->toDateString();

        $query = Client::query();

        if (isset($validated['cliente_id'])) {
            $query->where('id', $validated['cliente_id']);
        }

        $clients = $query->get();

        $results = [];

        foreach ($clients as $client) {
            $contractIds = $client->contracts()->pluck('id');

            if ($contractIds->isEmpty()) {
                $results[] = [
                    'cliente_id' => $client->id,
                    'razon_social' => $client->razon_social,
                    'ingresos' => 0.0,
                    'costos' => 0.0,
                    'insumos_toner' => 0.0,
                    'margen' => 0.0,
                ];
                continue;
            }

            // D19: ingresos atribuidos vía invoice_details de los contratos
            // del cliente (factura mono o multi-contrato), sin BORRADORES.
            $ingresos = DB::table('invoice_details')
                ->join('invoices', 'invoice_details.factura_id', '=', 'invoices.id')
                ->whereIn('invoice_details.contrato_id', $contractIds)
                ->where('invoices.estado', '!=', 'BORRADOR')
                ->whereBetween('invoices.periodo_inicio', [$periodoInicio, $periodoFin])
                ->sum('invoice_details.monto_calculado');

            $printerIds = ContractPrinter::whereIn('contrato_id', $contractIds)
                ->where('activa', true)
                ->pluck('impresora_id');

            // Mismo desglose que perPrinter (fuente única: costByPrinter):
            // gastos + mantenimiento + insumos de tóner de las impresoras
            // activas. A nivel cliente los insumos son exactos: la entrega
            // vive a nivel contrato, el reparto por impresora no distorsiona.
            $insumosToner = 0.0;
            $otrosCostos = 0.0;

            if ($printerIds->isNotEmpty()) {
                foreach ($this->profitabilityService->costByPrinter($printerIds->all(), $periodoInicio, $periodoFin) as $costo) {
                    $otrosCostos += $costo['gastos'] + $costo['mantenimiento'];
                    $insumosToner += $costo['insumos_toner'];
                }
            }

            $costos = $otrosCostos + $insumosToner;
            $margen = $ingresos - $costos;

            $results[] = [
                'cliente_id' => $client->id,
                'razon_social' => $client->razon_social,
                'ingresos' => (float) $ingresos,
                'costos' => (float) $costos,
                'insumos_toner' => (float) $insumosToner,
                'margen' => (float) $margen,
            ];
        }

        return response()->json($results);
    }

    public function cashFlow(Request $request)
    {
        $validated = $request->validate([
            'meses' => 'nullable|integer|min:1|max:24',
        ]);

        $meses = $validated['meses'] ?? 6;

        return response()->json($this->cashFlowService->getCashFlowSeries($meses));
    }
}