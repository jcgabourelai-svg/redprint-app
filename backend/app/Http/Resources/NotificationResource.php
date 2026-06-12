<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tipo' => $this->tipo,
            'titulo' => $this->titulo,
            'mensaje' => $this->mensaje,
            'leida' => $this->leida,
            'referencia_tipo' => $this->referencia_tipo,
            'referencia_id' => $this->referencia_id,
            'fecha' => $this->fecha?->toIso8601String(),
        ];
    }
}
