<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'numero_factura' => $this->numero_factura,
            'cliente_id' => $this->cliente_id,
            'fecha_emision' => $this->fecha_emision?->toDateString(),
            'fecha_vencimiento' => $this->fecha_vencimiento?->toDateString(),
            'periodo_inicio' => $this->periodo_inicio?->toDateString(),
            'periodo_fin' => $this->periodo_fin?->toDateString(),
            'monto_total' => $this->monto_total,
            'monto_pagado' => $this->monto_pagado,
            'saldo_pendiente' => $this->saldo_pendiente,
            'estado' => $this->when($this->estado, $this->estado?->value),
            'notas' => $this->notas,
            'client' => $this->whenLoaded('client'),
            'details' => InvoiceDetailResource::collection($this->whenLoaded('details')),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
        ];
    }
}
