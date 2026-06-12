<?php

namespace App\Services;

use App\Enums\MovementType;
use App\Enums\PurchaseStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Purchase;
use App\Models\PurchaseDetail;
use App\Models\SupplierPayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PurchaseService
{
    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function create(array $data, User $creator): Purchase
    {
        return DB::transaction(function () use ($data, $creator) {
            $details = $data['detalles'] ?? [];
            unset($data['detalles']);

            $data['socio_id'] = $creator->id;
            $data['estado'] = PurchaseStatus::PENDIENTE;
            $data['monto_total'] = 0;
            $data['monto_pagado'] = 0;
            $data['saldo_pendiente'] = 0;
            $data['fecha_creacion'] = now();

            $purchase = Purchase::create($data);

            $montoTotal = 0;
            foreach ($details as $detail) {
                $subtotal = $detail['cantidad'] * $detail['costo_unitario'];
                $montoTotal += $subtotal;

                PurchaseDetail::create([
                    'compra_id' => $purchase->id,
                    'articulo_id' => $detail['articulo_id'] ?? null,
                    'articulo_nombre' => $detail['articulo_nombre'],
                    'cantidad' => $detail['cantidad'],
                    'costo_unitario' => $detail['costo_unitario'],
                    'subtotal' => $subtotal,
                ]);
            }

            $purchase->update([
                'monto_total' => $montoTotal,
                'saldo_pendiente' => $montoTotal,
            ]);

            return $purchase->fresh(['supplier', 'details']);
        });
    }

    public function receive(Purchase $purchase, User $user): Purchase
    {
        if ($purchase->estado !== PurchaseStatus::PENDIENTE) {
            throw new BusinessRuleException('Solo se pueden recibir compras pendientes');
        }

        return DB::transaction(function () use ($purchase, $user) {
            $purchase->update(['estado' => PurchaseStatus::RECIBIDA]);

            foreach ($purchase->details as $detail) {
                if ($detail->article) {
                    $this->inventoryService->registerEntry(
                        $detail->article,
                        $detail->cantidad,
                        $user,
                        'Purchase',
                        $purchase->id,
                        "Entrada por compra #{$purchase->id}"
                    );
                }
            }

            return $purchase->fresh(['supplier', 'details']);
        });
    }

    public function cancel(Purchase $purchase, User $user): Purchase
    {
        if ($purchase->estado === PurchaseStatus::RECIBIDA) {
            throw new BusinessRuleException('No se puede cancelar una compra ya recibida');
        }

        $purchase->update(['estado' => PurchaseStatus::CANCELADA]);

        return $purchase->fresh();
    }

    public function registerSupplierPayment(array $data, User $creator): SupplierPayment
    {
        return DB::transaction(function () use ($data, $creator) {
            $purchase = Purchase::findOrFail($data['compra_id']);

            if ($purchase->saldo_pendiente <= 0) {
                throw new BusinessRuleException('La compra ya esta completamente pagada');
            }

            $data['socio_id'] = $creator->id;
            $data['fecha_creacion'] = now();

            $payment = SupplierPayment::create($data);

            $this->recalculateStatus($purchase);

            return $payment->fresh('purchase');
        });
    }

    public function recalculateStatus(Purchase $purchase): void
    {
        $totalPagado = $purchase->payments()->sum('monto');
        $saldoPendiente = (float) $purchase->monto_total - $totalPagado;

        $purchase->update([
            'monto_pagado' => $totalPagado,
            'saldo_pendiente' => max(0, $saldoPendiente),
        ]);
    }

    public function updatePendingBalance(Purchase $purchase): void
    {
        $this->recalculateStatus($purchase);
    }

    public function generateAccountPayable(): array
    {
        return Purchase::with(['supplier', 'details'])
            ->where('estado', PurchaseStatus::RECIBIDA)
            ->where('saldo_pendiente', '>', 0)
            ->orderBy('fecha_vto_pago', 'asc')
            ->get()
            ->toArray();
    }
}
