<?php

namespace App\Http\Resources;

use App\Models\ContractPrinter;
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
            'impresora_nombre' => $this->whenLoaded('printer', fn() => $this->resolverImpresoraNombre()),
            'impresora_alias' => $this->whenLoaded('printer', fn() => $this->resolverAsignacion()?->alias),
            'impresora_color' => $this->whenLoaded('printer', fn() => $this->resolverAsignacion()?->color),
            'socio_capturista' => $this->whenLoaded('socio', fn() => $this->socio?->nombre ?? '-'),
            'evidencia_foto' => $this->foto_evidencia,
            'printer' => $this->whenLoaded('printer'),
            'socio' => $this->whenLoaded('socio'),
            'visit' => $this->whenLoaded('visit'),
        ];
    }

    /**
     * Asignacion contrato-impresora de esta lectura: una sola resolucion
     * para alias y color (siempre de la misma fila). Solo consulta
     * assignments si ya fueron eager-loadeados (nunca lazy-load en
     * resources).
     */
    private function resolverAsignacion(): ?ContractPrinter
    {
        if (! $this->printer?->relationLoaded('assignments')) {
            return null;
        }

        return $this->printer->assignments->firstWhere('contrato_id', $this->contrato_id);
    }

    /**
     * Prioriza el alias del contrato ("Recepcion") sobre los identificadores
     * fisicos. Solo consulta assignments si ya fueron eager-loadeados.
     */
    private function resolverImpresoraNombre(): string
    {
        $printer = $this->printer;

        if ($printer === null) {
            return '-';
        }

        $alias = $this->resolverAsignacion()?->alias;

        if ($alias !== null) {
            return $alias;
        }

        return $printer->num_inventario ?? $printer->num_serie ?? $printer->modelo ?? '-';
    }
}
