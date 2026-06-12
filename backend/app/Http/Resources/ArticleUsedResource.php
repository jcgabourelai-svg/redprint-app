<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ArticleUsedResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'articulo_id' => $this->articulo_id,
            'article' => new ArticleResource($this->whenLoaded('article')),
            'cantidad' => $this->cantidad,
            'costo_unitario' => $this->costo_unitario,
            'subtotal' => $this->subtotal,
        ];
    }
}
