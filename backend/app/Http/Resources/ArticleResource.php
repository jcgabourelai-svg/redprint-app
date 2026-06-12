<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tipo_articulo' => $this->tipo_articulo?->value ?? $this->tipo_articulo,
            'subtipo' => $this->subtipo,
            'nombre' => $this->nombre,
            'marca' => $this->marca,
            'modelo_sku' => $this->modelo_sku,
            'stock_actual' => $this->stock_actual,
            'umbral_reposicion' => $this->umbral_reposicion,
            'costo_unitario' => $this->costo_unitario,
            'proveedor_id' => $this->proveedor_id,
            'supplier' => new SupplierResource($this->whenLoaded('supplier')),
            'impresoras_compatibles' => $this->impresoras_compatibles,
            'activo' => $this->activo,
            'is_low_stock' => $this->isLowStock(),
            'fecha_creacion' => $this->fecha_creacion,
        ];
    }
}
