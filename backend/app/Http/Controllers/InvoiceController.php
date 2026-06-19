<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreInvoiceRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Services\InvoiceService;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    use Sortable;

    public function __construct(
        private InvoiceService $invoiceService
    ) {}

    public function index(Request $request)
    {
        $query = Invoice::with(['client', 'contract', 'socio'])
            ->when($request->estado, fn($q, $e) => $q->where('estado', $e))
            ->when($request->cliente_id, fn($q, $id) => $q->where('cliente_id', $id))
            ->search($request->search, ['numero_factura']);

        $this->applySorting($query, $request, [
            'id', 'numero_factura', 'estado', 'monto_total', 'fecha_emision', 'created_at',
        ], 'created_at', 'desc');

        $invoices = $query->paginate($request->per_page ?? 15);

        return InvoiceResource::collection($invoices);
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        $invoice->load(['client', 'contract', 'details', 'payments.socio', 'socio']);
        return new InvoiceResource($invoice);
    }

    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $invoice = $this->invoiceService->create($request->validated(), $request->user());
        return response()->json(new InvoiceResource($invoice), 201);
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
