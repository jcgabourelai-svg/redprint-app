<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PrinterResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'marca' => $this->marca,
            'modelo' => $this->modelo,
            'printer_model_id' => $this->printer_model_id,
            'num_serie' => $this->num_serie,
            'num_inventario' => $this->num_inventario,
            'codigo_negocio' => $this->codigo_negocio,
            'fecha_adquisicion' => $this->fecha_adquisicion?->toDateString(),
            'costo_adquisicion' => $this->costo_adquisicion,
            'vida_util_meses' => $this->vida_util_meses,
            'garantia_hasta' => $this->garantia_hasta?->toDateString(),
            'garantia_status' => $this->garantia_status,
            'vida_util_restante' => $this->vida_util_restante,
            'estado' => $this->when($this->estado, $this->estado?->value),
            'contador_actual' => $this->contador_actual,
            'history_count' => $this->whenNotNull($this->history_count),
            'maintenance_orders_count' => $this->whenNotNull($this->maintenance_orders_count),
            'warehouse' => $this->whenLoaded('warehouse'),
            // Cliente del contrato con asignacion activa (ubicacion real cuando
            // la impresora esta rentada). null si no hay asignacion activa.
            'cliente' => $this->whenLoaded('currentAssignment', function () {
                $contract = $this->currentAssignment?->contract;

                return $contract === null ? null : [
                    'id' => $contract->client?->id,
                    'nombre' => $contract->client?->razon_social,
                    'contrato_id' => $contract->id,
                    'contrato_codigo' => $contract->codigo_negocio,
                ];
            }),
            'creator' => $this->whenLoaded('creator'),
            'fecha_creacion' => $this->fecha_creacion?->toIso8601String(),
        ];
    }
}
