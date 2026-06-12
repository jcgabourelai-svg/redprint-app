<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class PrinterCollection extends ResourceCollection
{
    public function toArray(Request $request): array
    {
        return [
            'data' => $this->collection->map(fn ($printer) => [
                'id' => $printer->id,
                'marca' => $printer->marca,
                'modelo' => $printer->modelo,
                'num_serie' => $printer->num_serie,
                'codigo_negocio' => $printer->codigo_negocio,
                'estado' => $printer->estado?->value,
                'contador_actual' => $printer->contador_actual,
                'warehouse' => $printer->whenLoaded('warehouse'),
                'fecha_creacion' => $printer->fecha_creacion?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $this->currentPage(),
                'last_page' => $this->lastPage(),
                'per_page' => $this->perPage(),
                'total' => $this->total(),
            ],
        ];
    }
}
