<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierPaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'compra_id' => $this->compra_id,
            'purchase' => new PurchaseResource($this->whenLoaded('purchase')),
            'fecha' => $this->fecha?->format('Y-m-d'),
            'monto' => $this->monto,
            'metodo' => $this->metodo?->value ?? $this->metodo,
            'socio_id' => $this->socio_id,
            'socio' => new UserResource($this->whenLoaded('socio')),
            'comprobante' => $this->comprobante,
            'fecha_creacion' => $this->fecha_creacion,
        ];
    }
}
