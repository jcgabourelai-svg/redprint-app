<?php

namespace App\Http\Controllers;

use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Exceptions\BusinessRuleException;
use App\Http\Requests\StoreContractRequest;
use App\Http\Resources\ContractResource;
use App\Models\Contract;
use App\Models\Visit;
use App\Services\ContractService;
use App\Services\VisitService;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContractController extends Controller
{
    use Sortable;

    public function __construct(
        private ContractService $contractService,
        private VisitService $visitService
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
            'visita_id' => 'nullable|exists:visits,id',
        ]);

        $visita = isset($data['visita_id'])
            ? $this->resolveVisitaParaContrato((int) $data['visita_id'], $contract)
            : null;

        $this->contractService->assignPrinter(
            $contract,
            $data['impresora_id'],
            $data['lectura_inicial'] ?? 0,
            $request->user(),
            $visita?->id
        );

        $this->autoCompletarVisita($visita, VisitType::INSTALACION);

        return response()->json(new ContractResource($contract->fresh(['client', 'printers'])));
    }

    public function releasePrinter(Request $request, Contract $contract): JsonResponse
    {
        $data = $request->validate([
            'impresora_id' => 'required|exists:printers,id',
            'almacen_destino_id' => 'required|exists:warehouses,id',
            'visita_id' => 'nullable|exists:visits,id',
        ]);

        $visita = isset($data['visita_id'])
            ? $this->resolveVisitaParaContrato((int) $data['visita_id'], $contract)
            : null;

        $printer = \App\Models\Printer::findOrFail($data['impresora_id']);
        $this->contractService->releasePrinter(
            $contract,
            $printer,
            $data['almacen_destino_id'],
            $request->user(),
            $visita?->id
        );

        $this->autoCompletarVisita($visita, VisitType::RETIRO);

        return response()->json(new ContractResource($contract->fresh(['client', 'printers'])));
    }

    /**
     * Valida la visita a vincular: debe pertenecer al mismo contrato y no
     * estar cancelada/omitida. Se admite una visita ya completada para que una
     * segunda instalacion/retiro sobre la misma visita no falle.
     */
    private function resolveVisitaParaContrato(int $visitaId, Contract $contract): Visit
    {
        $visita = Visit::findOrFail($visitaId);

        if ($visita->contrato_id !== $contract->id) {
            throw new BusinessRuleException('La visita indicada no pertenece a este contrato');
        }

        if (in_array($visita->estado, [VisitStatus::CANCELADA, VisitStatus::OMITIDA], true)) {
            throw new BusinessRuleException('La visita indicada está cancelada u omitida');
        }

        return $visita;
    }

    /**
     * Auto-completa la visita si su tipo coincide con la operacion y sigue
     * editable; el guard es silencioso: nunca interrumpe la operacion.
     */
    private function autoCompletarVisita(?Visit $visita, VisitType $tipoEsperado): void
    {
        if (! $visita) {
            return;
        }

        $visita->refresh();

        if ($visita->tipo_visita !== $tipoEsperado) {
            return;
        }

        if (! in_array($visita->estado, [VisitStatus::PENDIENTE, VisitStatus::REPROGRAMADA], true)) {
            return;
        }

        try {
            $this->visitService->complete($visita);
        } catch (BusinessRuleException) {
            // Guard silencioso: el cambio de impresora ya quedo registrado.
        }
    }
}
