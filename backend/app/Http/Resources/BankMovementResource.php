<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BankMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cuenta_bancaria_id' => $this->cuenta_bancaria_id,
            'tipo' => $this->tipo,
            'monto' => $this->monto,
            'referencia' => $this->referencia,
            'descripcion' => $this->descripcion,
            'conciliacion_status' => $this->conciliacion_status,
            'transaccion_vinculada_id' => $this->transaccion_vinculada_id,
            'categoria' => $this->categoria,
            'fecha' => $this->fecha?->toDateString(),
            'socio_id' => $this->socio_id,
            'cuenta' => BankAccountResource::make($this->whenLoaded('cuenta')),
            'socio' => UserResource::make($this->whenLoaded('socio')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}