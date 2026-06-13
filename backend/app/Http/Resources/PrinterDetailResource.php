<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class PrinterDetailResource extends PrinterResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return array_merge(parent::toArray($request), [
            'ultima_lectura' => $this->whenLoaded('readings', fn () => $this->readings->first()?->valor_contador),
            'fecha_ultima_lectura' => $this->whenLoaded('readings', fn () => $this->readings->first()?->fecha?->toDateString()),
            'historial' => PrinterHistoryResource::collection($this->whenLoaded('history')),
            'mantenimientos' => MaintenanceOrderResource::collection($this->whenLoaded('maintenanceOrders')),
            'lecturas' => ReadingResource::collection($this->whenLoaded('readings')),
            'es_eliminable' => $this->esEliminable(),
        ]);
    }
}
