<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMaintenanceOrderRequest;
use App\Http\Requests\UpdateMaintenanceOrderRequest;
use App\Http\Resources\MaintenanceOrderResource;
use App\Models\MaintenanceOrder;
use App\Services\MaintenanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceOrderController extends Controller
{
    public function __construct(
        private MaintenanceService $maintenanceService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = MaintenanceOrder::with(['printer', 'socio', 'visit']);

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }
        if ($request->has('tipo_mantto')) {
            $query->where('tipo_mantto', $request->tipo_mantto);
        }
        if ($request->has('impresora_id')) {
            $query->where('impresora_id', $request->impresora_id);
        }
        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->fecha_hasta);
        }

        $orders = $query->orderBy('fecha', 'desc')->paginate($request->per_page ?? 20);

        return MaintenanceOrderResource::collection($orders)->response();
    }

    public function show(MaintenanceOrder $maintenanceOrder): JsonResponse
    {
        return response()->json(new MaintenanceOrderResource(
            $maintenanceOrder->load(['printer', 'socio', 'visit', 'articlesUsed.article', 'expenses'])
        ));
    }

    public function store(StoreMaintenanceOrderRequest $request): JsonResponse
    {
        $order = $this->maintenanceService->create(
            $request->validated(),
            $request->user()
        );

        return response()->json(new MaintenanceOrderResource($order), 201);
    }

    public function update(UpdateMaintenanceOrderRequest $request, MaintenanceOrder $maintenanceOrder): JsonResponse
    {
        $maintenanceOrder->update($request->validated());

        return response()->json(new MaintenanceOrderResource($maintenanceOrder->fresh(['printer'])));
    }

    public function complete(Request $request, MaintenanceOrder $maintenanceOrder): JsonResponse
    {
        $order = $this->maintenanceService->complete(
            $maintenanceOrder,
            $request->validate([
                'trabajo_realizado' => 'nullable|string',
                'costo_mano_obra' => 'nullable|numeric|min:0',
            ]),
            $request->user()
        );

        return response()->json(new MaintenanceOrderResource($order));
    }

    public function cancel(MaintenanceOrder $maintenanceOrder): JsonResponse
    {
        $order = $this->maintenanceService->cancel($maintenanceOrder, request()->user());

        return response()->json(new MaintenanceOrderResource($order));
    }

    public function addArticle(Request $request, MaintenanceOrder $maintenanceOrder): JsonResponse
    {
        $validated = $request->validate([
            'articulo_id' => 'required|exists:articles,id',
            'cantidad' => 'required|integer|min:1',
        ]);

        $articleUsed = $this->maintenanceService->addArticle(
            $maintenanceOrder,
            $validated['articulo_id'],
            $validated['cantidad'],
            $request->user()
        );

        return response()->json($articleUsed->load('article'), 201);
    }

    public function removeArticle(MaintenanceOrder $maintenanceOrder, int $articleUsedId): JsonResponse
    {
        $this->maintenanceService->removeArticle($maintenanceOrder, $articleUsedId);

        return response()->json(['message' => 'Articulo removido']);
    }

    public function articles(MaintenanceOrder $maintenanceOrder): JsonResponse
    {
        return response()->json($maintenanceOrder->articlesUsed()->with('article')->get());
    }
}
