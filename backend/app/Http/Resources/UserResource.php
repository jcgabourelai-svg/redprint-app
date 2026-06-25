<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $role = $this->role;

        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'correo' => $this->correo,
            'telefono' => $this->telefono,
            'rol_id' => $role?->id,
            'rol_nombre' => $role?->nombre,
            'rol_slug' => $role?->slug,
            'es_sistema' => (bool) ($role?->es_sistema),
            'activo' => $this->activo,
            'ultimo_acceso' => $this->when($this->ultimo_acceso, $this->ultimo_acceso?->toIso8601String()),
            'fecha_creacion' => $this->fecha_creacion?->toIso8601String(),
        ];
    }
}
