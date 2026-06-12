<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InventoryMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'articulo_id' => $this->articulo_id,
            'article' => new ArticleResource($this->whenLoaded('article')),
            'tipo_movimiento' => $this->tipo_movimiento?->value ?? $this->tipo_movimiento,
            'cantidad' => $this->cantidad,
            'stock_anterior' => $this->stock_anterior,
            'stock_posterior' => $this->stock_posterior,
            'referencia_tipo' => $this->referencia_tipo,
            'referencia_id' => $this->referencia_id,
            'justificacion' => $this->justificacion,
            'fecha' => $this->fecha?->format('Y-m-d'),
            'socio' => new UserResource($this->whenLoaded('socio')),
            'fecha_creacion' => $this->fecha_creacion,
        ];
    }
}
