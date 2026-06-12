<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePurchaseRequest;
use App\Http\Resources\PurchaseResource;
use App\Models\Purchase;
use App\Services\PurchaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseController extends Controller
{
    public function __construct(
        private PurchaseService $purchaseService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Purchase::with(['supplier', 'socio']);

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }
        if ($request->has('proveedor_id')) {
            $query->where('proveedor_id', $request->proveedor_id);
        }
        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->fecha_hasta);
        }

        $purchases = $query->orderBy('fecha', 'desc')->paginate($request->per_page ?? 20);

        return PurchaseResource::collection($purchases)->response();
    }

    public function show(Purchase $purchase): JsonResponse
    {
        return response()->json(new PurchaseResource(
            $purchase->load(['supplier', 'details.article', 'payments.socio'])
        ));
    }

    public function store(StorePurchaseRequest $request): JsonResponse
    {
        $purchase = $this->purchaseService->create(
            $request->validated(),
            $request->user()
        );

        return response()->json(new PurchaseResource($purchase), 201);
    }

    public function receive(Purchase $purchase): JsonResponse
    {
        $purchase = $this->purchaseService->receive($purchase, request()->user());

        return response()->json(new PurchaseResource($purchase->load(['supplier', 'details.article'])));
    }

    public function cancel(Purchase $purchase): JsonResponse
    {
        $purchase = $this->purchaseService->cancel($purchase, request()->user());

        return response()->json(new PurchaseResource($purchase));
    }

    public function details(Purchase $purchase): JsonResponse
    {
        return response()->json($purchase->details()->with('article')->get());
    }
}
