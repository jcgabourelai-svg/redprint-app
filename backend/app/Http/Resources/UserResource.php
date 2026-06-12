<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'correo' => $this->correo,
            'telefono' => $this->telefono,
            'rol' => $this->when($this->rol, $this->rol?->value),
            'activo' => $this->activo,
            'ultimo_acceso' => $this->when($this->ultimo_acceso, $this->ultimo_acceso?->toIso8601String()),
            'fecha_creacion' => $this->fecha_creacion?->toIso8601String(),
        ];
    }
}
