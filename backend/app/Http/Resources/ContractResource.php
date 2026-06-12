<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContractResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'codigo_negocio' => $this->codigo_negocio,
            'cliente_id' => $this->cliente_id,
            'fecha_inicio' => $this->fecha_inicio?->toDateString(),
            'fecha_fin' => $this->fecha_fin?->toDateString(),
            'tarifa_base' => $this->tarifa_base,
            'paginas_incluidas' => $this->paginas_incluidas,
            'costo_pag_excedente' => $this->costo_pag_excedente,
            'dias_gracia' => $this->dias_gracia,
            'frecuencia_visitas' => $this->when($this->frecuencia_visitas, $this->frecuencia_visitas?->value),
            'dias_adelanto' => $this->dias_adelanto,
            'estado' => $this->when($this->estado, $this->estado?->value),
            'rentabilidad' => $this->rentabilidad,
            'ingresos' => $this->ingresos,
            'costos' => $this->costos,
            'margen' => $this->margen,
            'printers_count' => $this->whenNotNull($this->printers_count),
            'client' => $this->whenLoaded('client'),
            'printers' => PrinterResource::collection($this->whenLoaded('printers')),
            'fecha_creacion' => $this->fecha_creacion?->toIso8601String(),
        ];
    }
}
