<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'proveedor_id' => $this->proveedor_id,
            'supplier' => new SupplierResource($this->whenLoaded('supplier')),
            'fecha' => $this->fecha?->format('Y-m-d'),
            'fecha_vto_pago' => $this->fecha_vto_pago?->format('Y-m-d'),
            'concepto' => $this->concepto,
            'monto_total' => $this->monto_total,
            'monto_pagado' => $this->monto_pagado,
            'saldo_pendiente' => $this->saldo_pendiente,
            'metodo_pago' => $this->metodo_pago,
            'estado' => $this->estado?->value ?? $this->estado,
            'comprobante' => $this->comprobante,
            'socio_id' => $this->socio_id,
            'details' => PurchaseDetailResource::collection($this->whenLoaded('details')),
            'payments' => SupplierPaymentResource::collection($this->whenLoaded('payments')),
            'fecha_creacion' => $this->fecha_creacion,
        ];
    }
}
