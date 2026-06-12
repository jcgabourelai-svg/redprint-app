<?php

namespace App\Http\Controllers;

use App\Http\Resources\WarehouseResource;
use App\Models\Warehouse;
use App\Models\Printer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WarehouseController extends Controller
{
    public function index(Request $request)
    {
        $warehouses = Warehouse::with(['responsable'])
            ->withCount('printers')
            ->when($request->search, fn($q, $s) => $q->where('nombre', 'ilike', "%{$s}%"))
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        return WarehouseResource::collection($warehouses);
    }

    public function show(Warehouse $warehouse): WarehouseResource
    {
        $warehouse->load(['responsable', 'printers']);
        return new WarehouseResource($warehouse);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:255',
            'direccion' => 'required|string',
            'responsable_id' => 'nullable|exists:users,id',
        ]);

        $warehouse = Warehouse::create($data);
        return response()->json(new WarehouseResource($warehouse), 201);
    }

    public function update(Request $request, Warehouse $warehouse): WarehouseResource
    {
        $data = $request->validate([
            'nombre' => 'sometimes|string|max:255',
            'direccion' => 'sometimes|string',
            'responsable_id' => 'nullable|exists:users,id',
        ]);

        $warehouse->update($data);
        return new WarehouseResource($warehouse->fresh());
    }

    public function deactivate(Warehouse $warehouse): JsonResponse
    {
        if ($warehouse->printers()->count() > 0) {
            return response()->json(['message' => 'No se puede desactivar un almacen con impresoras asignadas'], 422);
        }

        $warehouse->update(['activo' => false]);
        return response()->json(['message' => 'Almacen desactivado']);
    }

    public function printers(Warehouse $warehouse, Request $request)
    {
        $printers = $warehouse->printers()
            ->when($request->estado, fn($q, $e) => $q->where('estado', $e))
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        return response()->json($printers);
    }
}
