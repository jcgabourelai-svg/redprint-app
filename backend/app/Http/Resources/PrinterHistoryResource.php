<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PrinterHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'fecha' => $this->fecha?->toDateString(),
            'tipo' => $this->tipo_evento,
            'descripcion' => $this->descripcion,
            'detalles' => $this->datos_adicionales ? json_encode($this->datos_adicionales) : null,
            'responsable' => $this->socio?->nombre ?? '-',
        ];
    }
}
