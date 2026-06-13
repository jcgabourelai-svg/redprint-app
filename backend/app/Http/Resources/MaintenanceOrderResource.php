<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MaintenanceOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'impresora_id' => $this->impresora_id,
            'printer' => new PrinterResource($this->whenLoaded('printer')),
            'fecha' => $this->fecha?->format('Y-m-d'),
            'tipo_mantto' => $this->tipo_mantto?->value ?? $this->tipo_mantto,
            'desc_problema' => $this->desc_problema,
            'trabajo_realizado' => $this->trabajo_realizado,
            'costo_mano_obra' => $this->costo_mano_obra,
            'costo_total' => $this->costo_total,
            'socio_id' => $this->socio_id,
            'socio' => new UserResource($this->whenLoaded('socio')),
            'visita_id' => $this->visita_id,
            'visit' => new VisitResource($this->whenLoaded('visit')),
            'estado' => $this->estado?->value ?? $this->estado,
            'articles_used' => ArticleUsedResource::collection($this->whenLoaded('articlesUsed')),
            'expenses' => PrinterExpenseResource::collection($this->whenLoaded('expenses')),
            'fecha_creacion' => $this->fecha_creacion,
        ];
    }
}
