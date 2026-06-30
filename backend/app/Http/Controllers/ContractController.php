<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreContractRequest;
use App\Http\Resources\ContractResource;
use App\Models\Contract;
use App\Services\ContractService;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractController extends Controller
{
    use Sortable;

    public function __construct(
        private ContractService $contractService
    ) {}

    public function index(Request $request)
    {
        $query = Contract::with(['client', 'printers'])
            ->when($request->estado, fn($q, $e) => $q->where('estado', $e))
            ->when($request->cliente_id, fn($q, $id) => $q->where('cliente_id', $id))
            ->search($request->search, ['codigo_negocio']);

        $this->applySorting($query, $request, [
            'id', 'codigo_negocio', 'estado', 'fecha_inicio', 'fecha_fin', 'created_at',
        ], 'created_at', 'desc');

        $contracts = $query->paginate($request->per_page ?? 15);

        return ContractResource::collection($contracts);
    }

    public function show(Contract $contract): ContractResource
    {
        $contract->load(['client', 'printers.maintenanceOrders', 'printers.expenses', 'visits', 'invoices']);
        return new ContractResource($contract);
    }

    public function store(StoreContractRequest $request): JsonResponse
    {
        $contract = $this->contractService->create($request->validated(), $request->user());
        return response()->json(new ContractResource($contract), 201);
    }

    public function update(Request $request, Contract $contract): ContractResource
    {
        $data = $request->validate([
            'tarifa_base' => 'sometimes|numeric|min:0',
            'paginas_incluidas' => 'sometimes|integer|min:0',
            'costo_pag_excedente' => 'sometimes|numeric|min:0',
            'dias_gracia' => 'sometimes|integer|min:0',
            'frecuencia_visitas' => 'sometimes|string',
            'dias_adelanto' => 'sometimes|integer|min:1',
            'dia_visita' => 'sometimes|integer|between:1,31|nullable',
            'fecha_fin' => 'sometimes|date|nullable',
        ]);

        $contract->update($data);
        return new ContractResource($contract->fresh());
    }

    public function assignPrinter(Request $request, Contract $contract): JsonResponse
    {
        $data = $request->validate([
            'impresora_id' => 'required|exists:printers,id',
            'lectura_inicial' => 'nullable|integer|min:0',
        ]);

        $this->contractService->assignPrinter(
            $contract,
            $data['impresora_id'],
            $data['lectura_inicial'] ?? 0,
            $request->user()
        );

        return response()->json(new ContractResource($contract->fresh(['client', 'printers'])));
    }

    public function releasePrinter(Request $request, Contract $contract): JsonResponse
    {
        $data = $request->validate([
            'impresora_id' => 'required|exists:printers,id',
            'almacen_destino_id' => 'required|exists:warehouses,id',
        ]);

        $printer = \App\Models\Printer::findOrFail($data['impresora_id']);
        $this->contractService->releasePrinter(
            $contract,
            $printer,
            $data['almacen_destino_id'],
            $request->user()
        );

        return response()->json(new ContractResource($contract->fresh(['client', 'printers'])));
    }
}
