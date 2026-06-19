<?php

namespace App\Http\Controllers;

use App\Http\Resources\SupplierPaymentResource;
use App\Services\PurchaseService;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierPaymentController extends Controller
{
    use Sortable;

    public function __construct(
        private PurchaseService $purchaseService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = \App\Models\SupplierPayment::with(['purchase.supplier', 'socio']);

        if ($request->has('compra_id')) {
            $query->where('compra_id', $request->compra_id);
        }
        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->fecha_hasta);
        }

        $this->applySorting($query, $request, [
            'id', 'fecha', 'monto', 'created_at',
        ], 'fecha', 'desc');

        $payments = $query->paginate($request->per_page ?? 20);

        return SupplierPaymentResource::collection($payments)->response();
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'compra_id' => 'required|exists:purchases,id',
            'fecha' => 'required|date',
            'monto' => 'required|numeric|min:0.01',
            'metodo' => 'required|in:TRANSFERENCIA,EFECTIVO,CHEQUE',
            'comprobante' => 'nullable|string',
        ]);

        $payment = $this->purchaseService->registerSupplierPayment($validated, $request->user());

        return response()->json(new SupplierPaymentResource($payment->load('purchase.supplier')), 201);
    }
}
