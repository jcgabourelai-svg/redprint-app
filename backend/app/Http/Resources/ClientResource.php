<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'razon_social' => $this->razon_social,
            'rfc' => $this->rfc,
            'nombre_contacto' => $this->nombre_contacto,
            'telefono' => $this->telefono,
            'correo' => $this->correo,
            'direccion_instalacion' => $this->direccion_instalacion,
            'notas' => $this->notas,
            'contratos_activos_count' => $this->whenNotNull($this->contratos_activos_count),
            'saldo_pendiente' => $this->saldo_pendiente,
            'estado' => $this->estado,
            'active_contract' => new ContractResource($this->whenLoaded('activeContract')),
            'contracts' => ContractResource::collection($this->whenLoaded('contracts')),
            'fecha_creacion' => $this->fecha_creacion?->toIso8601String(),
        ];
    }
}
