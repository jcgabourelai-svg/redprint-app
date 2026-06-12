<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PaymentService
{
    public function __construct(
        private InvoiceService $invoiceService
    ) {}

    public function registerPayment(array $data, User $creator): Payment
    {
        return DB::transaction(function () use ($data, $creator) {
            $invoice = Invoice::findOrFail($data['factura_id']);

            $this->validateAmount($invoice, $data['monto']);

            $data['creado_por'] = $creator->id;
            $data['socio_id'] = $creator->id;
            $data['fecha_creacion'] = now();

            $payment = Payment::create($data);

            $invoice->increment('monto_pagado', $data['monto']);
            $invoice->decrement('saldo_pendiente', $data['monto']);

            $this->invoiceService->updateStatusAutomatic($invoice->fresh());

            return $payment;
        });
    }

    public function validateAmount(Invoice $invoice, float $amount): void
    {
        if ($amount <= 0) {
            throw new BusinessRuleException('El monto del pago debe ser mayor a 0');
        }

        if ($amount > $invoice->saldo_pendiente) {
            throw new BusinessRuleException('El monto excede el saldo pendiente');
        }
    }

    public function recalculateInvoiceStatus(Invoice $invoice): Invoice
    {
        $totalPayments = $invoice->payments()->sum('monto');

        $invoice->update([
            'monto_pagado' => $totalPayments,
            'saldo_pendiente' => max(0, $invoice->monto_total - $totalPayments),
        ]);

        return $this->invoiceService->updateStatusAutomatic($invoice->fresh());
    }
}
