<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VisitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cliente_id' => $this->cliente_id,
            'contrato_id' => $this->contrato_id,
            'tipo_visita' => $this->when($this->tipo_visita, $this->tipo_visita?->value),
            'fecha_programada' => $this->fecha_programada?->toDateString(),
            'fecha_realizada' => $this->when($this->fecha_realizada, $this->fecha_realizada?->toIso8601String()),
            'socio_id' => $this->socio_id,
            'estado' => $this->when($this->estado, $this->estado?->value),
            'notas' => $this->notas,
            'client' => $this->whenLoaded('client'),
            'contract' => $this->whenLoaded('contract'),
            'socio' => $this->whenLoaded('socio'),
            'readings' => ReadingResource::collection($this->whenLoaded('readings')),
        ];
    }
}
