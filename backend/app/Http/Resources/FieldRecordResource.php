<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FieldRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tipo' => $this->tipo?->value,
            'estado' => $this->estado?->value,
            'nombre_cliente_reportado' => $this->nombre_cliente_reportado,
            'direccion_reportada' => $this->direccion_reportada,
            'marca_reportada' => $this->marca_reportada,
            'modelo_reportada' => $this->modelo_reportada,
            'num_serie_reportado' => $this->num_serie_reportado,
            'valor_contador' => $this->valor_contador,
            'articulos_entregados' => $this->articulos_entregados,
            'notas' => $this->notas,
            'foto_evidencia' => $this->foto_evidencia,
            'ubicacion_lat' => $this->ubicacion_lat,
            'ubicacion_lng' => $this->ubicacion_lng,
            'capturado_en' => $this->capturado_en?->toIso8601String(),
            'client_uuid' => $this->client_uuid,
            'socio_id' => $this->socio_id,
            'socio_nombre' => $this->whenLoaded('socio', fn () => $this->socio?->nombre),
            'cliente_id' => $this->cliente_id,
            'contrato_id' => $this->contrato_id,
            'impresora_id' => $this->impresora_id,
            'visita_id' => $this->visita_id,
            'lectura_id' => $this->lectura_id,
            'vinculado_en' => $this->vinculado_en?->toIso8601String(),
            'motivo_descarte' => $this->motivo_descarte,
            'client' => $this->whenLoaded('client'),
            'contract' => $this->whenLoaded('contract'),
            'printer' => $this->whenLoaded('printer'),
            'visit' => $this->whenLoaded('visit'),
            'reading' => $this->whenLoaded('reading'),
            'vinculado_por' => $this->whenLoaded('vinculadoPor', fn () => $this->vinculadoPor?->nombre),
        ];
    }
}
