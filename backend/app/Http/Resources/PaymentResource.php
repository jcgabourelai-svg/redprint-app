<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'factura_id' => $this->factura_id,
            'fecha' => $this->fecha?->toDateString(),
            'monto' => $this->monto,
            'metodo_pago' => $this->when($this->metodo_pago, $this->metodo_pago?->value),
            'nota' => $this->nota,
            'socio' => $this->whenLoaded('socio'),
        ];
    }
}
