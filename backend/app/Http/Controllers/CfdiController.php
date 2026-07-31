<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportCfdiRequest;
use App\Http\Resources\InvoiceResource;
use App\Http\Resources\XmlComprobanteResource;
use App\Models\XmlComprobante;
use App\Services\CfdiService;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CfdiController extends Controller
{
    use Sortable;

    public function __construct(
        private CfdiService $cfdiService
    ) {}

    public function index(Request $request)
    {
        $query = XmlComprobante::with(['receptor', 'invoice'])
            ->when($request->tipo_comprobante, fn($q, $v) => $q->where('tipo_comprobante', $v))
            ->when($request->receptor_id, fn($q, $v) => $q->where('receptor_id', $v))
            ->when(
                $request->estado_conciliacion === 'sin_factura',
                fn($q) => $q->sinFactura()
            )
            ->when(
                $request->estado_conciliacion === 'conciliado',
                fn($q) => $q->whereHas('invoice')
            )
            ->when(
                $request->estado_cliente === 'sin_cliente',
                fn($q) => $q->sinCliente()
            )
            ->when(
                $request->estado_cliente === 'asignado',
                fn($q) => $q->whereNotNull('receptor_id')
            )
            ->search($request->search, ['uuid', 'serie_folio', 'rfc_receptor', 'nombre_receptor']);

        $this->applySorting($query, $request, [
            'id', 'fecha_emision', 'serie_folio', 'total', 'rfc_receptor', 'tipo_comprobante', 'created_at',
        ], 'fecha_emision', 'desc');

        $comprobantes = $query->paginate($request->per_page ?? 15);

        return XmlComprobanteResource::collection($comprobantes);
    }

    public function show(XmlComprobante $cfdi): XmlComprobanteResource
    {
        $cfdi->load(['conceptos', 'invoice.client', 'receptor']);
        return new XmlComprobanteResource($cfdi);
    }

    public function import(ImportCfdiRequest $request): JsonResponse
    {
        $files = $request->file('archivos');
        $resultados = $this->cfdiService->importFiles($files, $request->user());

        return response()->json([
            'resultados' => collect($resultados)->map(fn($r) => [
                'archivo' => $r['archivo'],
                'estado' => $r['estado'],
                'xml_comprobante' => $r['xml_comprobante'] !== null
                    ? new XmlComprobanteResource($r['xml_comprobante'])
                    : null,
                'errores' => $r['errores'],
            ])->all(),
        ]);
    }

    public function generateInvoice(Request $request, XmlComprobante $cfdi): JsonResponse
    {
        $validated = $request->validate([
            'fecha_vencimiento' => 'nullable|date',
            'notas' => 'nullable|string',
        ]);

        $invoice = $this->cfdiService->generateInvoice($cfdi, $request->user(), $validated);

        return response()->json(new InvoiceResource($invoice), 201);
    }

    public function link(Request $request, XmlComprobante $cfdi): JsonResponse
    {
        $validated = $request->validate([
            'invoice_id' => 'required|exists:invoices,id',
        ]);

        $invoice = $this->cfdiService->linkToInvoice($cfdi, (int) $validated['invoice_id']);

        return response()->json(new InvoiceResource($invoice));
    }

    public function unlink(XmlComprobante $cfdi): JsonResponse
    {
        $this->cfdiService->unlink($cfdi);

        return response()->json(['message' => 'Comprobante desvinculado.']);
    }

    public function update(Request $request, XmlComprobante $cfdi): XmlComprobanteResource
    {
        $validated = $request->validate([
            'cliente_id' => 'nullable|exists:clients,id',
            'notas' => 'nullable|string',
        ]);

        $comprobante = $this->cfdiService->assignClient(
            $cfdi,
            isset($validated['cliente_id']) ? (int) $validated['cliente_id'] : null,
            $validated['notas'] ?? null
        );

        return new XmlComprobanteResource($comprobante);
    }

    public function destroy(XmlComprobante $cfdi): JsonResponse
    {
        $this->cfdiService->delete($cfdi);

        return response()->json(['message' => 'Comprobante eliminado.']);
    }
}
