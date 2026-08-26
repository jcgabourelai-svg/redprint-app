<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ArticleDeliveryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'articulo_id' => $this->articulo_id,
            'visita_id' => $this->visita_id,
            'contrato_id' => $this->contrato_id,
            'cliente_id' => $this->cliente_id,
            'cantidad' => $this->cantidad,
            'costo_unitario' => $this->costo_unitario,
            'subtotal' => $this->subtotal,
            'notas' => $this->notas,
            'article' => $this->whenLoaded('article', fn () => $this->article ? [
                'id' => $this->article->id,
                'nombre' => $this->article->nombre,
                'marca' => $this->article->marca,
                'modelo_sku' => $this->article->modelo_sku,
                'subtipo' => $this->article->subtipo,
            ] : null),
            'fecha_creacion' => $this->fecha_creacion?->toIso8601String(),
        ];
    }
}
