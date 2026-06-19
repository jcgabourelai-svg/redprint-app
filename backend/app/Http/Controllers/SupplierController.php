<?php

namespace App\Http\Controllers;

use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    use Sortable;

    public function index(Request $request)
    {
        $query = Supplier::search($request->search, ['razon_social'])
            ->where('activo', true);

        $this->applySorting($query, $request, [
            'id', 'razon_social', 'created_at',
        ], 'razon_social', 'asc');

        $suppliers = $query->paginate($request->per_page ?? 15);

        return SupplierResource::collection($suppliers);
    }

    public function show(Supplier $supplier): SupplierResource
    {
        return new SupplierResource($supplier);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'razon_social' => 'required|string|max:255',
            'rfc' => 'nullable|string|max:20',
            'contacto' => 'nullable|string|max:255',
            'telefono' => 'nullable|string|max:30',
            'correo' => 'nullable|email|max:255',
            'notas' => 'nullable|string',
        ]);

        $supplier = Supplier::create($data);
        return response()->json(new SupplierResource($supplier), 201);
    }

    public function update(Request $request, Supplier $supplier): SupplierResource
    {
        $data = $request->validate([
            'razon_social' => 'sometimes|string|max:255',
            'rfc' => 'nullable|string|max:20',
            'contacto' => 'nullable|string|max:255',
            'telefono' => 'nullable|string|max:30',
            'correo' => 'nullable|email|max:255',
            'notas' => 'nullable|string',
        ]);

        $supplier->update($data);
        return new SupplierResource($supplier);
    }
}
