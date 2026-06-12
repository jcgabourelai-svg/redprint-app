<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BankAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'banco' => $this->banco,
            'tipo_cuenta' => $this->tipo_cuenta,
            'numero_cuenta' => $this->numero_cuenta,
            'moneda' => $this->moneda,
            'saldo' => $this->saldo,
            'saldo_inicial' => $this->saldo_inicial,
            'descripcion' => $this->descripcion,
            'activo' => $this->activo,
            'socio_id' => $this->socio_id,
            'socio' => UserResource::make($this->whenLoaded('socio')),
            'movements_count' => $this->when($this->movements_count ?? null, $this->movements_count),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}