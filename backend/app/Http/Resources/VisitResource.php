<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VisitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'cliente_id' => $this->cliente_id,
            'contrato_id' => $this->contrato_id,
            'tipo_visita' => $this->when($this->tipo_visita, $this->tipo_visita?->value),
            'fecha_programada' => $this->fecha_programada?->toDateString(),
            'fecha_realizada' => $this->when($this->fecha_realizada, $this->fecha_realizada?->toIso8601String()),
            'socio_id' => $this->socio_id,
            'cliente_nombre' => $this->whenLoaded('client', fn () => $this->client?->razon_social),
            'socio_nombre' => $this->whenLoaded('socio', fn () => $this->socio?->nombre),
            'estado' => $this->when($this->estado, $this->estado?->value),
            'notas' => $this->notas,
            'motivo_cierre' => $this->motivo_cierre,
            'origen' => $this->origen,
            'impresoras' => $this->whenLoaded('contract', fn () => $this->resolveImpresoras()),
            'client' => $this->whenLoaded('client'),
            'contract' => $this->whenLoaded('contract'),
            'socio' => $this->whenLoaded('socio'),
            'readings' => ReadingResource::collection($this->whenLoaded('readings')),
            'entregas' => ArticleDeliveryResource::collection($this->whenLoaded('deliveries')),
            'mantenimientos' => MaintenanceOrderResource::collection($this->whenLoaded('maintenanceOrders')),
            'cambios_impresoras' => $this->whenLoaded('printer_changes', fn () => $this->printer_changes
                ->map(fn ($h) => [
                    'evento' => $h->tipo_evento,
                    'fecha' => $h->fecha?->toIso8601String(),
                    'alias' => $h->datos_adicionales['alias'] ?? null,
                    'color' => $h->datos_adicionales['color'] ?? null,
                    'impresora' => $h->printer ? [
                        'id' => $h->printer->id,
                        'marca' => $h->printer->marca,
                        'modelo' => $h->printer->modelo,
                        'num_serie' => $h->printer->num_serie,
                    ] : null,
                ])
                ->values()
                ->all()),
        ];
    }

    protected function resolveImpresoras(): array
    {
        $contract = $this->whenLoaded('contract');
        if (! $contract) {
            return [];
        }

        return $contract->activePrinters
            ->map(function ($printer) use ($contract) {
                $latest = $printer->relationLoaded('latestReading') ? $printer->latestReading : null;
                $lecturaAnterior = $latest
                    ? (int) $latest->valor_contador - (int) ($latest->paginas_periodo ?? 0)
                    : ((int) $printer->pivot?->lectura_inicial ?? $printer->contador_actual ?? 0);

                return [
                    'id' => (string) ($printer->pivot?->id ?? $printer->id),
                    'impresora_id' => (string) $printer->id,
                    'marca' => $printer->marca,
                    'modelo' => $printer->modelo,
                    'numero_serie' => $printer->num_serie,
                    'alias' => $printer->pivot?->alias,
                    'color' => $printer->pivot?->color,
                    'contrato_id' => (string) $contract->id,
                    'lectura_anterior' => (int) $lecturaAnterior,
                    'fecha_lectura_anterior' => $latest?->fecha?->toDateString(),
                ];
            })
            ->values()
            ->all();
    }
}
