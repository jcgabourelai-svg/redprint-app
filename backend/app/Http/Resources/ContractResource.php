<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContractResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $impresoras = $this->resolverImpresoras();

        // Estimado del periodo (intención comercial basada en contadores);
        // se expone como campo propio, nunca como "ingresos".
        $estimadoTotal = null;
        if ($impresoras !== null) {
            $estimadoTotal = round(collect($impresoras)->sum('estimado_del_periodo'), 2);
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
            'dia_visita' => $this->dia_visita,
            'estado' => $this->when($this->estado, $this->estado?->value),
            // Ingresos/costos/rentabilidad/margen son datos REALES del
            // contrato (cobrado vs costos). El estimado se expone aparte.
            'ingresos' => $this->ingresos,
            'costos' => $this->costos,
            'rentabilidad' => $this->rentabilidad,
            'margen' => $this->margen,
            'estimado_periodo_total' => $this->whenNotNull($estimadoTotal),
            'printers_count' => $this->whenNotNull($this->printers_count),
            'active_printers_count' => $this->whenNotNull($this->active_printers_count),
            'client' => $this->whenLoaded('client'),
            'printers' => PrinterResource::collection($this->whenLoaded('printers')),
            'impresoras' => $this->when(isset($impresoras), $impresoras),
            'plan_impresoras' => $this->whenLoaded('planImpresoras', fn () => $this->resolverPlanImpresoras()),
            'pendientes_instalacion' => $this->whenNotNull($this->resolverPendientesInstalacion()),
            'fecha_creacion' => $this->fecha_creacion?->toIso8601String(),
        ];
    }

    /**
     * Plan de modelos (intención comercial). `instaladas` cuenta las
     * asignaciones ACTIVAS del contrato cuyo printer_model_id coincide;
     * requiere `printers` cargada (el pivot es la única fuente de verdad).
     */
    private function resolverPlanImpresoras(): array
    {
        $printers = $this->resource->relationLoaded('printers') ? $this->printers : null;

        return $this->planImpresoras
            ->map(function ($fila) use ($printers) {
                $instaladas = $printers !== null
                    ? $printers->filter(
                        fn ($p) => $p->pivot->activa
                            && (int) $p->printer_model_id === (int) $fila->printer_model_id
                    )->count()
                    : null;

                return [
                    'id' => $fila->id,
                    'modelo_id' => $fila->printer_model_id,
                    'marca' => $fila->printerModel?->brand?->nombre,
                    'modelo_nombre' => $fila->printerModel?->nombre,
                    'cantidad' => (int) $fila->cantidad,
                    'instaladas' => $instaladas,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Equipos planificados sin asignación activa (floor 0). Usa el
     * withCount('activePrinters') si está disponible; si no, deriva el
     * conteo de la relación `printers` cargada. Null = sin datos para
     * calcularlo (plan no cargado).
     */
    private function resolverPendientesInstalacion(): ?int
    {
        if (! $this->resource->relationLoaded('planImpresoras')) {
            return null;
        }

        $totalPlan = (int) $this->planImpresoras->sum('cantidad');

        if ($this->active_printers_count !== null) {
            return max(0, $totalPlan - (int) $this->active_printers_count);
        }

        if ($this->resource->relationLoaded('printers')) {
            $activas = $this->printers->filter(fn ($p) => (bool) $p->pivot->activa)->count();
            return max(0, $totalPlan - $activas);
        }

        return null;
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
            'alias' => $printer->pivot->alias,
            'color' => $printer->pivot->color,
            'fecha_asignacion' => $printer->pivot->fecha_asignacion,
            'fecha_liberacion' => $printer->pivot->fecha_liberacion,
            'activa' => (bool) $printer->pivot->activa,
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
