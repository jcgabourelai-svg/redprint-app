<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\SupplierPayment;
use App\Models\PrinterExpense;
use App\Models\Purchase;
use App\Models\Printer;
use App\Models\Client;
use App\Models\MaintenanceOrder;
use App\Models\Contract;
use App\Models\ContractPrinter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinanceReportController extends Controller
{
    public function profitability(Request $request)
    {
        $validated = $request->validate([
            'periodo_inicio' => 'nullable|date',
            'periodo_fin' => 'nullable|date|after_or_equal:periodo_inicio',
            'printer_id' => 'nullable|exists:printers,id',
        ]);

        $periodoInicio = $validated['periodo_inicio'] ?? now()->startOfMonth()->toDateString();
        $periodoFin = $validated['periodo_fin'] ?? now()->endOfMonth()->toDateString();

        $query = Printer::query();

        if (isset($validated['printer_id'])) {
            $query->where('id', $validated['printer_id']);
        }

        $printers = $query->get();

        $results = [];

        foreach ($printers as $printer) {
            $ingresos = DB::table('invoices')
                ->join('contracts', 'invoices.contrato_id', '=', 'contracts.id')
                ->join('contract_printer', 'contracts.id', '=', 'contract_printer.contrato_id')
                ->where('contract_printer.impresora_id', $printer->id)
                ->where('contract_printer.activa', true)
                ->whereBetween('invoices.periodo_inicio', [$periodoInicio, $periodoFin])
                ->sum('invoices.monto_total');

            $costosGastos = PrinterExpense::where('impresora_id', $printer->id)
                ->whereBetween('fecha', [$periodoInicio, $periodoFin])
                ->sum('monto');

            $costosMantenimiento = MaintenanceOrder::where('impresora_id', $printer->id)
                ->whereBetween('fecha', [$periodoInicio, $periodoFin])
                ->sum('costo_total');

            $costos = $costosGastos + $costosMantenimiento;
            $margen = $ingresos - $costos;

            $roi = null;
            if ($printer->costo_adquisicion > 0) {
                $roi = ($margen / $printer->costo_adquisicion) * 100;
            }

            $results[] = [
                'impresora_id' => $printer->id,
                'marca' => $printer->marca,
                'modelo' => $printer->modelo,
                'codigo_negocio' => $printer->codigo_negocio,
                'ingresos' => (float) $ingresos,
                'costos' => (float) $costos,
                'margen' => (float) $margen,
                'roi' => $roi !== null ? (float) $roi : null,
            ];
        }

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

            $costos = 0.0;

            if ($printerIds->isNotEmpty()) {
                $costosGastos = PrinterExpense::whereIn('impresora_id', $printerIds)
                    ->whereBetween('fecha', [$periodoInicio, $periodoFin])
                    ->sum('monto');

                $costosMantenimiento = MaintenanceOrder::whereIn('impresora_id', $printerIds)
                    ->whereBetween('fecha', [$periodoInicio, $periodoFin])
                    ->sum('costo_total');

                $costos = $costosGastos + $costosMantenimiento;
            }

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

        $results = [];
        $acumulado = 0.0;

        for ($i = $meses - 1; $i >= 0; $i--) {
            $month = now()->subMonths($i);
            $monthStart = $month->copy()->startOfMonth();
            $monthEnd = $month->copy()->endOfMonth();

            $ingresos = Payment::whereBetween('fecha', [$monthStart, $monthEnd])
                ->sum('monto');

            $egresosProveedores = SupplierPayment::whereBetween('fecha', [$monthStart, $monthEnd])
                ->sum('monto');

            $egresosImpresoras = PrinterExpense::whereBetween('fecha', [$monthStart, $monthEnd])
                ->sum('monto');

            $egresosCompras = Purchase::whereBetween('fecha', [$monthStart, $monthEnd])
                ->sum('monto_total');

            $egresos = $egresosProveedores + $egresosImpresoras + $egresosCompras;

            $flujoNeto = $ingresos - $egresos;
            $acumulado += $flujoNeto;

            $results[] = [
                'mes' => $month->format('Y-m'),
                'mes_nombre' => $month->translatedFormat('F Y'),
                'ingresos' => (float) $ingresos,
                'egresos' => (float) $egresos,
                'flujo_neto' => (float) $flujoNeto,
                'acumulado' => (float) $acumulado,
            ];
        }

        return response()->json($results);
    }
}