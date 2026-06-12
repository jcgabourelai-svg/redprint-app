<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        private PaymentService $paymentService
    ) {}

    public function index(Request $request)
    {
        $payments = Payment::with(['invoice.client', 'socio'])
            ->when($request->factura_id, fn($q, $id) => $q->where('factura_id', $id))
            ->when($request->cliente_id, fn($q, $id) => $q->whereHas('invoice', fn($q2) => $q2->where('cliente_id', $id)))
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 15);

        return PaymentResource::collection($payments);
    }

    public function store(StorePaymentRequest $request): JsonResponse
    {
        $payment = $this->paymentService->registerPayment($request->validated(), $request->user());
        return response()->json(new PaymentResource($payment->load('invoice')), 201);
    }
}
