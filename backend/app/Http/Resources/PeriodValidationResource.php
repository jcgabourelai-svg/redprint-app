<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PeriodValidationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'period_close_id' => $this->period_close_id,
            'nombre' => $this->nombre,
            'estado' => $this->estado,
            'mensaje' => $this->mensaje,
            'link' => $this->link,
        ];
    }
}