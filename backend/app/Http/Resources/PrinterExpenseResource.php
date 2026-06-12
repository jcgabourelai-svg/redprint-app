<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PrinterExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'impresora_id' => $this->impresora_id,
            'printer' => new PrinterResource($this->whenLoaded('printer')),
            'tipo' => $this->tipo?->value ?? $this->tipo,
            'monto' => $this->monto,
            'fecha' => $this->fecha?->format('Y-m-d'),
            'descripcion' => $this->descripcion,
            'socio_id' => $this->socio_id,
            'socio' => new UserResource($this->whenLoaded('socio')),
            'orden_mantto_id' => $this->orden_mantto_id,
            'maintenanceOrder' => new MaintenanceOrderResource($this->whenLoaded('maintenanceOrder')),
            'comprobante' => $this->comprobante,
            'fecha_creacion' => $this->fecha_creacion,
        ];
    }
}
