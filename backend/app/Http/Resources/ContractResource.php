<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContractResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $impresoras = $this->resolverImpresoras();

        $estimadoTotal = null;
        $rentabilidadTotal = null;
        if ($impresoras !== null) {
            $estimadoTotal = round(collect($impresoras)->sum('estimado_del_periodo'), 2);
            $rentabilidadTotal = round(collect($impresoras)->sum('rentabilidad_acumulada'), 2);
        }

        return [
            'id' => $this->id,
            'codigo_negocio' => $this->codigo_negocio,
            'cliente_id' => $this->cliente_id,
            'cliente_nombre' => $this->whenLoaded('client', fn () => $this->client?->razon_social),
            'cliente_contacto' => $this->whenLoaded('client', fn () => $this->client?->nombre_contacto),
            'cliente_rfc' => $this->whenLoaded('client', fn () => $this->client?->rfc),
            'fecha_inicio' => $this->fecha_inicio?->toDateString(),
            'fecha_fin' => $this->fecha_fin?->toDateString(),
            'tarifa_base' => $this->tarifa_base,
            'paginas_incluidas' => $this->paginas_incluidas,
            'costo_pag_excedente' => $this->costo_pag_excedente,
            'costo_por_pagina_excedente' => $this->costo_pag_excedente,
            'dias_gracia' => $this->dias_gracia,
            'frecuencia_visitas' => $this->when($this->frecuencia_visitas, $this->frecuencia_visitas?->value),
            'dias_adelanto' => $this->dias_adelanto,
            'estado' => $this->when($this->estado, $this->estado?->value),
            'ingresos' => $impresoras !== null ? $estimadoTotal : $this->ingresos,
            'costos' => $impresoras !== null ? round($estimadoTotal - $rentabilidadTotal, 2) : $this->costos,
            'rentabilidad' => $impresoras !== null ? $rentabilidadTotal : $this->rentabilidad,
            'margen' => $impresoras !== null
                ? round(($rentabilidadTotal / max($estimadoTotal, 1)) * 100, 2)
                : $this->margen,
            'printers_count' => $this->whenNotNull($this->printers_count),
            'client' => $this->whenLoaded('client'),
            'printers' => PrinterResource::collection($this->whenLoaded('printers')),
            'impresoras' => $this->when(isset($impresoras), $impresoras),
            'fecha_creacion' => $this->fecha_creacion?->toIso8601String(),
        ];
    }

    private function resolverImpresoras(): ?array
    {
        if (! $this->resource->relationLoaded('printers')) {
            return null;
        }

        $printers = $this->printers;

        if ($printers->isNotEmpty() && ! $printers->first()->relationLoaded('maintenanceOrders')) {
            return null;
        }

        $totalPaginas = $printers->sum(
            fn ($p) => max(0, (int) $p->contador_actual - (int) ($p->pivot->lectura_inicial ?? 0))
        );

        $estimadoContrato = $totalPaginas > 0
            ? (float) $this->calculateEstimatedAmount($totalPaginas)
            : 0.0;

        return $printers
            ->map(fn ($printer) => $this->printerAssignmentToArray($printer, $totalPaginas, $estimadoContrato))
            ->values()
            ->all();
    }

    private function printerAssignmentToArray($printer, int $totalPaginas, float $estimadoContrato): array
    {
        $lecturaInicial = (int) ($printer->pivot->lectura_inicial ?? 0);
        $contadorActual = (int) ($printer->contador_actual ?? 0);
        $paginasPeriodo = max(0, $contadorActual - $lecturaInicial);

        $estimadoPeriodo = $totalPaginas > 0
            ? round($estimadoContrato * ($paginasPeriodo / $totalPaginas), 2)
            : 0.0;

        $costosImpresora = $this->costosPorAsignacion($printer);
        $rentabilidadAcumulada = round($estimadoPeriodo - $costosImpresora, 2);

        return [
            'id' => $printer->pivot->id,
            'impresora_id' => $printer->id,
            'impresora_marca' => $printer->marca,
            'impresora_modelo' => $printer->modelo,
            'impresora_serie' => $printer->num_serie,
            'fecha_asignacion' => $printer->pivot->fecha_asignacion,
            'lectura_inicial' => $lecturaInicial,
            'contador_actual' => $contadorActual,
            'paginas_del_periodo' => $paginasPeriodo,
            'estimado_del_periodo' => $estimadoPeriodo,
            'rentabilidad_acumulada' => $rentabilidadAcumulada,
        ];
    }

    private function costosPorAsignacion($printer): float
    {
        if (! $printer->relationLoaded('maintenanceOrders') || ! $printer->relationLoaded('expenses')) {
            return 0.0;
        }

        $desde = $printer->pivot->fecha_asignacion
            ? \Illuminate\Support\Carbon::parse($printer->pivot->fecha_asignacion)->startOfDay()
            : null;
        $hasta = $printer->pivot->fecha_liberacion
            ? \Illuminate\Support\Carbon::parse($printer->pivot->fecha_liberacion)->endOfDay()
            : now();

        $enVentana = function ($item) use ($desde, $hasta) {
            if ($desde === null || $item->fecha === null) {
                return true;
            }

            return \Illuminate\Support\Carbon::parse($item->fecha)->betweenIncluded($desde, $hasta);
        };

        $mantenimiento = (float) $printer->maintenanceOrders->filter($enVentana)->sum('costo_total');
        $gastos = (float) $printer->expenses->filter($enVentana)->sum('monto');

        return round($mantenimiento + $gastos, 2);
    }
}
