<?php

namespace App\Http\Controllers;

use App\Http\Resources\InventoryMovementResource;
use App\Models\InventoryMovement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = InventoryMovement::with(['article', 'socio']);

        if ($request->has('articulo_id')) {
            $query->where('articulo_id', $request->articulo_id);
        }
        if ($request->has('tipo_movimiento')) {
            $query->where('tipo_movimiento', $request->tipo_movimiento);
        }
        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->fecha_hasta);
        }
        if ($request->has('referencia_tipo')) {
            $query->where('referencia_tipo', $request->referencia_tipo);
        }

        $movements = $query->orderBy('fecha', 'desc')->paginate($request->per_page ?? 20);

        return InventoryMovementResource::collection($movements)->response();
    }

    public function show(InventoryMovement $inventoryMovement): JsonResponse
    {
        return response()->json(new InventoryMovementResource($inventoryMovement->load(['article', 'socio'])));
    }
}
