<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WarehouseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'direccion' => $this->direccion,
            'responsable' => $this->whenLoaded('responsable'),
            'activo' => $this->activo,
            'printers_count' => $this->whenCounted('printers'),
        ];
    }
}
