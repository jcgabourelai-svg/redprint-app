<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'slug' => $this->slug,
            'descripcion' => $this->descripcion,
            'es_sistema' => (bool) $this->es_sistema,
            'permisos' => $this->whenLoaded('permissions', fn () => $this->permissions->pluck('clave')->all(), []),
            'permisos_count' => $this->whenLoaded('permissions', fn () => $this->permissions->count()),
        ];
    }
}
