<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreReadingRequest;
use App\Http\Resources\ReadingResource;
use App\Models\Reading;
use App\Services\ReadingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReadingController extends Controller
{
    public function __construct(
        private ReadingService $readingService
    ) {}

    public function index(Request $request)
    {
        $readings = Reading::with(['printer', 'visit', 'socio'])
            ->when($request->impresora_id, fn($q, $id) => $q->where('impresora_id', $id))
            ->when($request->contrato_id, fn($q, $id) => $q->where('contrato_id', $id))
            ->orderBy('fecha', 'desc')
            ->paginate($request->per_page ?? 15);

        return ReadingResource::collection($readings);
    }

    public function store(StoreReadingRequest $request): JsonResponse
    {
        $reading = $this->readingService->captureReading($request->validated(), $request->user());

        $contract = $reading->contract;
        $estimatedAmount = $contract?->calculateEstimatedAmount($reading->paginas_periodo);

        return response()->json([
            'reading' => new ReadingResource($reading->load(['printer', 'visit'])),
            'paginas_consumidas' => $reading->paginas_periodo,
            'monto_estimado' => $estimatedAmount,
        ], 201);
    }

    public function getByVisit(int $visitId, Request $request)
    {
        $readings = Reading::with(['printer', 'socio'])
            ->where('visita_id', $visitId)
            ->orderBy('fecha', 'desc')
            ->get();

        return ReadingResource::collection($readings);
    }

    public function getByPrinter(int $printerId, Request $request)
    {
        $readings = Reading::with(['visit', 'socio'])
            ->where('impresora_id', $printerId)
            ->orderBy('fecha', 'desc')
            ->paginate($request->per_page ?? 15);

        return ReadingResource::collection($readings);
    }
}
