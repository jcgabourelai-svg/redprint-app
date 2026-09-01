<?php

namespace App\Http\Controllers;

use App\Enums\VisitStatus;
use App\Exceptions\BusinessRuleException;
use App\Http\Requests\StoreContractRequest;
use App\Http\Requests\UpdateContractPlanRequest;
use App\Http\Resources\ContractResource;
use App\Models\Contract;
use App\Models\ContractPrinter;
use App\Models\Visit;
use App\Services\ContractBillingService;
use App\Services\ContractService;
use App\Support\PrinterColorPalette;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ContractController extends Controller
{
    use Sortable;

    public function __construct(
        private ContractService $contractService,
        private ContractBillingService $contractBillingService,
    ) {}

    public function index(Request $request)
    {
        $query = Contract::with(['client', 'printers', 'planImpresoras.printerModel.brand'])
            ->withCount('activePrinters')
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
        $contract->load([
            'client',
            'printers.maintenanceOrders',
            'printers.expenses',
            'visits',
            'invoices',
            'planImpresoras.printerModel.brand',
        ]);
        $contract->loadCount('activePrinters');
        return new ContractResource($contract);
    }

    /**
     * Estado de facturación del contrato: periodos facturados vs pendientes
     * (D17). Expone datos de dinero: vive tras el permiso finanzas.facturas.
     */
    public function facturacion(Contract $contract): JsonResponse
    {
        return response()->json(
            $this->contractBillingService->estadoFacturacion($contract)
        );
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
            'alias' => 'nullable|string|max:60',
            // Solo la key invalida es 422; un color ocupado nunca es error
            // (fallback automatico al primer color libre dentro del servicio).
            'color' => ['nullable', 'string', Rule::in(PrinterColorPalette::KEYS)],
        ]);

        $visita = isset($data['visita_id'])
            ? $this->resolveVisitaParaContrato((int) $data['visita_id'], $contract)
            : null;

        $this->contractService->assignPrinter(
            $contract,
            $data['impresora_id'],
            $data['lectura_inicial'] ?? null,
            $request->user(),
            $visita?->id,
            $data['alias'] ?? null,
            $data['color'] ?? null
        );

        // Sin autocierre: la visita queda abierta para seguir registrando
        // actividades (insumos, lecturas, más instalaciones...) y se cierra
        // de forma explícita desde la app/web.

        $contract = $contract->fresh(['client', 'printers', 'planImpresoras.printerModel.brand']);
        $contract->loadCount('activePrinters');

        return response()->json(new ContractResource($contract));
    }

    /**
     * Reemplaza el plan de modelos contratados (intención comercial, no
     * asignaciones físicas). Solo contratos ACTIVOS.
     */
    public function updatePlan(UpdateContractPlanRequest $request, Contract $contract): ContractResource
    {
        $contract = $this->contractService->updatePlan(
            $contract,
            $request->validated('plan_impresoras', []) ?? []
        );

        return new ContractResource($contract);
    }

    /**
     * Renombra el alias ("Recepcion", "Taller"...) de una asignacion activa
     * del contrato. Cambio administrativo: no genera historial.
     */
    public function updateAssignmentAlias(Request $request, Contract $contract, int $assignment): ContractResource
    {
        $data = $request->validate([
            'alias' => 'nullable|string|max:60',
        ]);

        $assignmentModel = ContractPrinter::where('contrato_id', $contract->id)
            ->findOrFail($assignment);

        $this->contractService->updateAssignmentAlias($contract, $assignmentModel, $data['alias'] ?? null);

        return new ContractResource($this->freshConPlan($contract));
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

        // Sin autocierre (misma regla que la instalación): cierre explícito.

        return response()->json(new ContractResource($this->freshConPlan($contract)));
    }

    private function freshConPlan(Contract $contract): Contract
    {
        $contract = $contract->fresh(['client', 'printers', 'planImpresoras.printerModel.brand']);
        $contract->loadCount('activePrinters');

        return $contract;
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
}
