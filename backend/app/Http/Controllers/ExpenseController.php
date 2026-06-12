<?php

namespace App\Http\Controllers;

use App\Http\Resources\PrinterExpenseResource;
use App\Models\PrinterExpense;
use App\Services\MaintenanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function __construct(
        private MaintenanceService $maintenanceService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = PrinterExpense::with(['printer', 'socio', 'maintenanceOrder']);

        if ($request->has('impresora_id')) {
            $query->where('impresora_id', $request->impresora_id);
        }
        if ($request->has('tipo')) {
            $query->where('tipo', $request->tipo);
        }
        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->fecha_hasta);
        }

        $expenses = $query->orderBy('fecha', 'desc')->paginate($request->per_page ?? 20);

        return PrinterExpenseResource::collection($expenses)->response();
    }

    public function show(PrinterExpense $printerExpense): JsonResponse
    {
        return response()->json(new PrinterExpenseResource($printerExpense->load(['printer', 'socio', 'maintenanceOrder'])));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'impresora_id' => 'required|exists:printers,id',
            'tipo' => 'required|in:TRANSPORTE,OTRO',
            'monto' => 'required|numeric|min:0',
            'fecha' => 'required|date',
            'descripcion' => 'nullable|string',
            'orden_mantto_id' => 'nullable|exists:maintenance_orders,id',
            'comprobante' => 'nullable|string',
        ]);

        $expense = $this->maintenanceService->registerPrinterExpense($validated, $request->user());

        return response()->json(new PrinterExpenseResource($expense->load(['printer', 'maintenanceOrder'])), 201);
    }
}
