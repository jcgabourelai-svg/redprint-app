<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    public function create(array $data, User $creator): Invoice
    {
        $data['creado_por'] = $creator->id;
        $data['socio_id'] = $creator->id;
        $data['estado'] = InvoiceStatus::PENDIENTE;
        $data['saldo_pendiente'] = $data['monto_total'];
        $data['monto_pagado'] = 0;
        $data['fecha_creacion'] = now();

        return DB::transaction(function () use ($data) {
            $details = $data['detalles'] ?? [];
            unset($data['detalles']);

            $invoice = Invoice::create($data);

            foreach ($details as $detail) {
                $invoice->details()->create($detail);
            }

            return $invoice->fresh(['client', 'details']);
        });
    }

    public function updateStatusAutomatic(Invoice $invoice): Invoice
    {
        if ($invoice->saldo_pendiente <= 0) {
            $invoice->update(['estado' => InvoiceStatus::PAGADA, 'saldo_pendiente' => 0]);
        } elseif ($invoice->monto_pagado > 0) {
            if ($invoice->estado !== InvoiceStatus::VENCIDA && $invoice->estado !== InvoiceStatus::INCOBRABLE) {
                $invoice->update(['estado' => InvoiceStatus::PARCIALMENTE_PAGADA]);
            }
        }

        return $invoice->fresh();
    }

    public function checkOverdue(): int
    {
        return Invoice::where('estado', '!=', InvoiceStatus::PAGADA)
            ->where('estado', '!=', InvoiceStatus::INCOBRABLE)
            ->where('saldo_pendiente', '>', 0)
            ->where('fecha_vencimiento', '<', now())
            ->update(['estado' => InvoiceStatus::VENCIDA]);
    }

    public function getOutstandingBalance(?int $clientId = null): float
    {
        $query = Invoice::whereIn('estado', [
            InvoiceStatus::PENDIENTE,
            InvoiceStatus::PARCIALMENTE_PAGADA,
            InvoiceStatus::VENCIDA,
        ]);

        if ($clientId) {
            $query->where('cliente_id', $clientId);
        }

        return $query->sum('saldo_pendiente');
    }
}
