<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReadingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'visita_id' => $this->visita_id,
            'impresora_id' => $this->impresora_id,
            'contrato_id' => $this->contrato_id,
            'fecha' => $this->fecha?->toDateString(),
            'valor_contador' => $this->valor_contador,
            'lectura_anterior' => ($this->valor_contador ?? 0) - ($this->paginas_periodo ?? 0),
            'lectura_actual' => $this->valor_contador,
            'paginas_periodo' => $this->paginas_periodo,
            'paginas_consumidas' => $this->paginas_periodo,
            'es_anomalia' => $this->es_anomalia,
            'excepcion' => $this->es_anomalia ? ($this->justificacion_anomalia ?? 'Anómala') : null,
            'justificacion_anomalia' => $this->justificacion_anomalia,
            'impresora_nombre' => $this->whenLoaded('printer', fn() => $this->printer?->modelo ?? $this->printer?->serial ?? '-'),
            'socio_capturista' => $this->whenLoaded('socio', fn() => $this->socio?->name ?? '-'),
            'printer' => $this->whenLoaded('printer'),
            'socio' => $this->whenLoaded('socio'),
        ];
    }
}
