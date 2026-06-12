<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePrinterRequest;
use App\Http\Requests\UpdatePrinterRequest;
use App\Http\Resources\PrinterResource;
use App\Models\Printer;
use App\Services\PrinterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrinterController extends Controller
{
    public function __construct(
        private PrinterService $printerService
    ) {}

    public function index(Request $request)
    {
        $printers = Printer::with(['warehouse', 'creator'])
            ->when($request->estado, fn($q, $e) => $q->where('estado', $e))
            ->when($request->marca, fn($q, $m) => $q->where('marca', 'ilike', "%{$m}%"))
            ->when($request->modelo, fn($q, $m) => $q->where('modelo', 'ilike', "%{$m}%"))
            ->when($request->search, function ($q, $s) {
                $q->where(function ($query) use ($s) {
                    $query->where('codigo_negocio', 'ilike', "%{$s}%")
                        ->orWhere('num_serie', 'ilike', "%{$s}%")
                        ->orWhere('marca', 'ilike', "%{$s}%");
                });
            })
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        return PrinterResource::collection($printers);
    }

    public function show(Printer $printer): PrinterResource
    {
        $printer->load(['warehouse', 'history.socio', 'creator']);
        return new PrinterResource($printer);
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
        $this->printerService->deactivate($printer, $request->user(), 'Dada de baja por usuario');
        return response()->json(['message' => 'Impresora dada de baja']);
    }

    public function history(Printer $printer, Request $request)
    {
        $history = $this->printerService->getHistory($printer, $request->tipo_evento);
        return response()->json($history);
    }
}
