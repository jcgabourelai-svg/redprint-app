<?php

namespace App\Http\Controllers;

use App\Enums\InvoiceStatus;
use App\Http\Requests\EmitInvoiceRequest;
use App\Http\Requests\StoreInvoiceDraftBatchRequest;
use App\Http\Requests\StoreInvoiceDraftRequest;
use App\Http\Requests\StoreInvoiceRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Services\InvoiceCalculationService;
use App\Services\InvoiceService;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    use Sortable;

    public function __construct(
        private InvoiceService $invoiceService,
        private InvoiceCalculationService $calculationService
    ) {}

    public function calcular(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cliente_id' => 'required|exists:clients,id',
            'periodo_inicio' => 'required|date',
            'periodo_fin' => 'required|date|after_or_equal:periodo_inicio',
            'contrato_id' => 'nullable|exists:contracts,id',
        ]);

        $resultado = $this->calculationService->calcularEstimacion(
            (int) $data['cliente_id'],
            $data['periodo_inicio'],
            $data['periodo_fin'],
            null,
            isset($data['contrato_id']) ? (int) $data['contrato_id'] : null,
        );

        return response()->json($resultado);
    }

    public function index(Request $request)
    {
        $query = Invoice::with(['client', 'contract', 'socio']);

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        } else {
            // Los borradores solo aparecen con ?estado=BORRADOR explicito:
            // protege CxC, dashboards y reportes sin tocarlos.
            $query->where('estado', '!=', InvoiceStatus::BORRADOR->value);
        }

        $query->when($request->cliente_id, fn ($q, $id) => $q->where('cliente_id', $id))
            ->search($request->search, ['numero_factura']);

        $this->applySorting($query, $request, [
            'id', 'numero_factura', 'estado', 'monto_total', 'fecha_emision', 'created_at',
        ], 'created_at', 'desc');

        $invoices = $query->paginate($request->per_page ?? 15);

        return InvoiceResource::collection($invoices);
    }

    public function show(Request $request, Invoice $invoice): InvoiceResource
    {
        $relations = ['client', 'contract', 'details', 'payments.socio', 'socio'];
        // El comprobante CFDI solo se expone a roles con permiso de CFDI; evita
        // filtrar datos de comprobante a traves del endpoint de facturas.
        if ($request->user()?->tienePermiso('finanzas.cfdi')) {
            $relations[] = 'xmlComprobante.conceptos';
        }
        $invoice->load($relations);
        return new InvoiceResource($invoice);
    }

    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $invoice = $this->invoiceService->create($request->validated(), $request->user());
        return response()->json(new InvoiceResource($invoice), 201);
    }

    public function storeDraft(StoreInvoiceDraftRequest $request): JsonResponse
    {
        $result = $this->invoiceService->createDraft($request->validated(), $request->user());

        return (new InvoiceResource($result['invoice']))
            ->additional(['advertencias' => $result['advertencias']])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Batch de borradores por contrato: un borrador por periodo mensual
     * seleccionado (D17/D18). All-or-nothing: 201 con todo o 422 con nada.
     */
    public function storeDraftBatch(StoreInvoiceDraftBatchRequest $request): JsonResponse
    {
        $resultados = $this->invoiceService->createDraftBatch($request->validated(), $request->user());

        return response()->json([
            'data' => InvoiceResource::collection(collect($resultados)->pluck('invoice')->values()),
            'advertencias' => collect($resultados)
                ->mapWithKeys(fn (array $r, string $periodo) => [$periodo => $r['advertencias']]),
        ], 201);
    }

    public function emitir(EmitInvoiceRequest $request, Invoice $invoice): InvoiceResource
    {
        $invoice = $this->invoiceService->emitir($invoice, $request->validated());
        return new InvoiceResource($invoice);
    }

    public function recalcular(Request $request, Invoice $invoice): InvoiceResource
    {
        $result = $this->invoiceService->recalcular($invoice);

        return (new InvoiceResource($result['invoice']))
            ->additional(['advertencias' => $result['advertencias']]);
    }

    public function destroy(Request $request, Invoice $invoice): JsonResponse
    {
        $this->invoiceService->destroy($invoice);
        return response()->json(['message' => 'Borrador de factura eliminado.']);
    }

    public function update(Request $request, Invoice $invoice): InvoiceResource
    {
        $data = $request->validate([
            'notas' => 'nullable|string',
        ]);

        $invoice->update($data);
        return new InvoiceResource($invoice->fresh());
    }
}
