<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PrinterModelResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'brand_id' => $this->brand_id,
            'nombre' => $this->nombre,
            'marca' => $this->whenLoaded('brand', fn () => $this->brand?->nombre),
        ];
    }
}
