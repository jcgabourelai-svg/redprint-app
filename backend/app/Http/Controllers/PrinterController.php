<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePrinterRequest;
use App\Http\Requests\UpdatePrinterRequest;
use App\Http\Resources\PrinterDetailResource;
use App\Http\Resources\PrinterResource;
use App\Models\Printer;
use App\Services\PrinterService;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrinterController extends Controller
{
    use Sortable;

    public function __construct(
        private PrinterService $printerService
    ) {}

    public function index(Request $request)
    {
        $query = Printer::with(['warehouse', 'creator'])
            ->when($request->estado, fn($q, $e) => $q->where('estado', $e))
            ->when($request->marca, fn($q, $m) => $q->where('marca', 'ilike', "%{$m}%"))
            ->when($request->modelo, fn($q, $m) => $q->where('modelo', 'ilike', "%{$m}%"))
            ->search($request->search, ['codigo_negocio', 'num_serie', 'marca', 'modelo']);

        $this->applySorting($query, $request, [
            'id', 'codigo_negocio', 'num_serie', 'marca', 'modelo', 'estado', 'created_at',
        ], 'created_at', 'desc');

        $printers = $query->paginate($request->per_page ?? 15);

        return PrinterResource::collection($printers);
    }

    public function show(Printer $printer): PrinterDetailResource
    {
        $printer->load([
            'warehouse',
            'history' => fn ($q) => $q->with('socio')->orderByDesc('fecha')->limit(100),
            'readings' => fn ($q) => $q->with('socio')->orderByDesc('fecha')->limit(50),
            'maintenanceOrders' => fn ($q) => $q->with('socio')->orderByDesc('fecha')->limit(50),
            'creator',
        ]);
        return new PrinterDetailResource($printer);
    }

    public function store(StorePrinterRequest $request): JsonResponse
    {
        $printer = $this->printerService->create($request->validated(), $request->user());
        return response()->json(new PrinterResource($printer), 201);
    }

    public function update(UpdatePrinterRequest $request, Printer $printer): PrinterResource
    {
        $printer = $this->printerService->update($printer, $request->validated());
        return new PrinterResource($printer);
    }

    public function destroy(Printer $printer, Request $request): JsonResponse
    {
        $rawReason = $request->input('reason');
        $reason = ($rawReason !== null && trim((string) $rawReason) !== '') ? $rawReason : 'Dada de baja por usuario';
        $this->printerService->deactivate($printer, $request->user(), $reason);
        return response()->json(['message' => 'Impresora dada de baja']);
    }

    public function forceDelete(Printer $printer): JsonResponse
    {
        $this->printerService->forceDelete($printer);
        return response()->json(['message' => 'Impresora eliminada']);
    }

    public function history(Printer $printer, Request $request)
    {
        $history = $this->printerService->getHistory($printer, $request->tipo_evento);
        return response()->json($history);
    }
}
