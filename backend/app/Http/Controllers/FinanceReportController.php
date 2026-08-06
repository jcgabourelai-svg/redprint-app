<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Client;
use App\Models\ContractPrinter;
use App\Services\CashFlowService;
use App\Services\ProfitabilityService;
use Illuminate\Http\Request;

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
                    'margen' => 0.0,
                ];
                continue;
            }

            $ingresos = Invoice::whereIn('contrato_id', $contractIds)
                ->whereBetween('periodo_inicio', [$periodoInicio, $periodoFin])
                ->sum('monto_total');

            $printerIds = ContractPrinter::whereIn('contrato_id', $contractIds)
                ->where('activa', true)
                ->pluck('impresora_id');

            $costos = $printerIds->isNotEmpty()
                ? $this->profitabilityService->totalCostForPrinters($printerIds->all(), $periodoInicio, $periodoFin)
                : 0.0;

            $margen = $ingresos - $costos;

            $results[] = [
                'cliente_id' => $client->id,
                'razon_social' => $client->razon_social,
                'ingresos' => (float) $ingresos,
                'costos' => (float) $costos,
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