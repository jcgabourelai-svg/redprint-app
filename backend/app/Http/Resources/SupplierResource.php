<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'razon_social' => $this->razon_social,
            'rfc' => $this->rfc,
            'contacto' => $this->contacto,
            'telefono' => $this->telefono,
            'correo' => $this->correo,
            'notas' => $this->notas,
            'activo' => $this->activo,
        ];
    }
}
