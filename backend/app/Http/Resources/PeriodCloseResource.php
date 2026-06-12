<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PeriodCloseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'periodo' => $this->periodo,
            'estado' => $this->estado,
            'fecha_cierre' => $this->fecha_cierre,
            'cerrado_por' => $this->cerrado_por,
            'ingresos' => (float) $this->ingresos,
            'egresos' => (float) $this->egresos,
            'rentabilidad' => (float) $this->rentabilidad,
            'facturas_emitidas' => (int) $this->facturas_emitidas,
            'facturas_pagadas' => (int) $this->facturas_pagadas,
            'facturas_pendientes' => (int) $this->facturas_pendientes,
            'gastos_registrados' => (float) $this->gastos_registrados,
            'movimientos_bancarios' => (int) $this->movimientos_bancarios,
            'movimientos_conciliados' => (int) $this->movimientos_conciliados,
            'movimientos_pendientes' => (int) $this->movimientos_pendientes,
            'validations' => PeriodValidationResource::collection($this->whenLoaded('validations')),
            'cerradoPor' => $this->whenLoaded('cerradoPor'),
        ];
    }
}