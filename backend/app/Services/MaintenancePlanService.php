<?php

namespace App\Services;

use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use App\Enums\PrinterStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\MaintenanceOrder;
use App\Models\MaintenancePlan;
use App\Models\Printer;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Planes preventivos (F5): cadencia por meses y/o páginas con "el que ocurra
 * primero". Bandeja de sugerencias SIN auto-creación (decisión §6.6): la
 * orden nace de una confirmación explícita, individual o en lote.
 *
 * Nota: MaintenanceService inyecta esta clase (recálculo al completar), así
 * que crearOrdenDesdeSugerencia resuelve MaintenanceService perezosamente
 * desde el contenedor para evitar dependencia circular.
 */
class MaintenancePlanService
{
    /**
     * Plan efectivo de una impresora: el plan por impresora (override) gana
     * sobre el plan de su modelo (default de flota). Solo planes activos.
     */
    public function planEfectivo(Printer $printer): ?MaintenancePlan
    {
        $planPorImpresora = MaintenancePlan::activos()
            ->where('printer_id', $printer->id)
            ->orderByDesc('id')
            ->first();

        if ($planPorImpresora !== null) {
            return $planPorImpresora;
        }

        if ($printer->printer_model_id === null) {
            return null;
        }

        return MaintenancePlan::activos()
            ->where('printer_model_id', $printer->printer_model_id)
            ->whereNull('printer_id')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Al crear/activar un plan: backfill de ultimo_servicio_fecha desde la
     * última orden PREVENTIVO COMPLETADA de la impresora (o de cualquier
     * impresora del modelo para planes por modelo) y cálculo de proximo_*.
     * El contador base de arranque lo resuelve recalcularProximo con el
     * contador actual de la impresora (las órdenes no persisten contador).
     */
    public function syncHistorico(MaintenancePlan $plan): MaintenancePlan
    {
        if ($plan->ultimo_servicio_fecha === null && $plan->ultimo_servicio_contador === null) {
            $ultima = MaintenanceOrder::completada()
                ->where('tipo_mantto', MaintenanceType::PREVENTIVO)
                ->whereHas('printer', fn ($q) => $plan->printer_id !== null
                    ? $q->where('printers.id', $plan->printer_id)
                    : $q->where('printers.printer_model_id', $plan->printer_model_id))
                ->orderByDesc('fecha_completado')
                ->first();

            if ($ultima !== null) {
                $plan->ultimo_servicio_fecha = $ultima->fecha_completado?->toDateString();
            }
        }

        return $this->recalcularProximo($plan);
    }

    /**
     * Recalcula proximo_servicio_fecha / proximo_servicio_contador desde el
     * último servicio y la cadencia. Ambos definidos => "el que ocurra
     * primero": cada eje mantiene su propia proyección; la bandeja decide el
     * estado con el más urgente de los dos.
     */
    public function recalcularProximo(MaintenancePlan $plan): MaintenancePlan
    {
        $plan->proximo_servicio_fecha = null;
        $plan->proximo_servicio_contador = null;

        if ($plan->periodicidad_meses !== null && $plan->periodicidad_meses > 0) {
            $base = $plan->ultimo_servicio_fecha ?? today()->toDateString();
            $plan->proximo_servicio_fecha = \Carbon\Carbon::parse($base)
                ->addMonthsNoOverflow($plan->periodicidad_meses)
                ->toDateString();
        }

        if ($plan->periodicidad_paginas !== null && $plan->periodicidad_paginas > 0) {
            if ($plan->printer_id !== null) {
                $base = $plan->ultimo_servicio_contador
                    ?? (int) ($plan->printer?->contador_actual ?? 0);
                $plan->proximo_servicio_contador = $base + $plan->periodicidad_paginas;
            } elseif ($plan->ultimo_servicio_contador !== null) {
                // Plan por modelo sin contador base conocido: solo proyecta
                // si el backfill encontró un contador histórico.
                $plan->proximo_servicio_contador = $plan->ultimo_servicio_contador + $plan->periodicidad_paginas;
            }
        }

        $plan->save();

        return $plan->fresh();
    }

    /**
     * Bandeja de vencidos/próximos: para cada impresora activa con plan
     * efectivo calcula el estado SIN crear nada.
     *
     * Estados: VENCIDO (fecha <= hoy o contador ya rebasado),
     * PROXIMO (dentro de la ventana de aviso en días o páginas restantes
     * <= ventana_aviso_dias * 500 como aproximación de páginas/día), OK.
     */
    public function upcoming(): Collection
    {
        $printers = Printer::active()
            ->with('latestReading')
            ->get();

        $filas = collect();

        foreach ($printers as $printer) {
            $plan = $this->planEfectivo($printer);

            if ($plan === null) {
                continue;
            }

            $estado = 'OK';
            $detalle = [];

            $diasRestantes = null;
            $paginasRestantes = null;

            if ($plan->proximo_servicio_fecha !== null) {
                $diasRestantes = (int) today()->diffInDays(\Carbon\Carbon::parse($plan->proximo_servicio_fecha), false);

                if ($diasRestantes <= 0) {
                    $estado = 'VENCIDO';
                } elseif ($diasRestantes <= $plan->ventana_aviso_dias) {
                    $estado = 'PROXIMO';
                }

                $detalle[] = [
                    'eje' => 'FECHA',
                    'proximo' => $plan->proximo_servicio_fecha,
                    'dias_restantes' => $diasRestantes,
                ];
            }

            if ($plan->proximo_servicio_contador !== null) {
                $contadorActual = (int) $printer->contador_actual;
                $paginasRestantes = $plan->proximo_servicio_contador - $contadorActual;

                $paginasPorDia = $this->paginasPorDiaEstimadas($printer);
                $diasParaAlcanzar = $paginasPorDia > 0
                    ? (int) ceil($paginasRestantes / $paginasPorDia)
                    : null;

                if ($paginasRestantes <= 0) {
                    $estado = 'VENCIDO';
                } elseif (
                    $diasParaAlcanzar !== null
                    && $diasParaAlcanzar <= $plan->ventana_aviso_dias
                    && $estado !== 'VENCIDO'
                ) {
                    $estado = 'PROXIMO';
                }

                $detalle[] = [
                    'eje' => 'PAGINAS',
                    'proximo' => $plan->proximo_servicio_contador,
                    'paginas_restantes' => $paginasRestantes,
                ];
            }

            if ($estado === 'OK') {
                continue;
            }

            $filas->push([
                'plan_id' => $plan->id,
                'impresora_id' => $printer->id,
                'impresora' => [
                    'id' => $printer->id,
                    'marca' => $printer->marca,
                    'modelo' => $printer->modelo,
                    'codigo' => $printer->codigo_negocio,
                    'estado' => $printer->estado->value,
                    'contador_actual' => (int) $printer->contador_actual,
                ],
                'origen_plan' => $plan->printer_id !== null ? 'IMPRESORA' : 'MODELO',
                'periodicidad_meses' => $plan->periodicidad_meses,
                'periodicidad_paginas' => $plan->periodicidad_paginas,
                'ultimo_servicio_fecha' => $plan->ultimo_servicio_fecha?->toDateString(),
                'proximo_servicio_fecha' => $plan->proximo_servicio_fecha?->toDateString(),
                'dias_restantes' => $diasRestantes,
                'paginas_restantes' => $paginasRestantes,
                'tiene_orden_abierta' => $printer->openMaintenanceOrder()->exists(),
                'estado' => $estado,
                'detalle' => $detalle,
            ]);
        }

        // Vencidos primero, luego por urgencia de días restantes.
        return $filas->sort(function ($a, $b) {
            $ordenEstado = fn ($estado) => $estado === 'VENCIDO' ? 0 : 1;

            return [$ordenEstado($a['estado']), $a['dias_restantes'] ?? PHP_INT_MAX]
                <=> [$ordenEstado($b['estado']), $b['dias_restantes'] ?? PHP_INT_MAX];
        })->values();
    }

    /**
     * Crea la orden PREVENTIVO desde una sugerencia de la bandeja.
     * Idempotente: si la impresora ya tiene orden PROGRAMADA no se duplica.
     */
    public function crearOrdenDesdeSugerencia(Printer $printer, MaintenancePlan $plan, string $fecha, User $user): MaintenanceOrder
    {
        if (MaintenanceOrder::where('impresora_id', $printer->id)
            ->where('estado', MaintenanceStatus::PROGRAMADA)
            ->exists()
        ) {
            throw new BusinessRuleException(
                "La impresora #{$printer->id} ya tiene una orden PROGRAMADA; complétala o cancélala antes de crear otra."
            );
        }

        return app(MaintenanceService::class)->create([
            'impresora_id' => $printer->id,
            'fecha' => $fecha,
            'tipo_mantto' => MaintenanceType::PREVENTIVO->value,
            'desc_problema' => sprintf(
                'Preventivo planificado (plan #%d%s). %s',
                $plan->id,
                $plan->periodicidad_meses !== null ? " · cada {$plan->periodicidad_meses} meses" : '',
                $plan->periodicidad_paginas !== null ? "cada {$plan->periodicidad_paginas} páginas" : ''
            ),
            'maintenance_plan_id' => $plan->id,
        ], $user);
    }

    /**
     * Al completar una PREVENTIVO con plan efectivo: actualiza ultimo_* y
     * reproyecta proximo_*. Se invoca dentro de la transacción de complete.
     */
    public function recalcularTrasCompletar(MaintenanceOrder $order): void
    {
        if ($order->tipo_mantto !== MaintenanceType::PREVENTIVO) {
            return;
        }

        $printer = $order->printer;

        if ($printer === null) {
            return;
        }

        // Preferencia: plan trazado en la orden; si no, el efectivo vigente.
        $plan = $order->maintenance_plan_id !== null
            ? MaintenancePlan::find($order->maintenance_plan_id)
            : $this->planEfectivo($printer);

        if ($plan === null || !$plan->activo) {
            return;
        }

        $plan->ultimo_servicio_fecha = $order->fecha_completado?->toDateString() ?? today()->toDateString();
        $plan->ultimo_servicio_contador = (int) $printer->contador_actual;

        $this->recalcularProximo($plan);
    }

    /**
     * Backfill diario (comando maintenance:sync-plans): recalcula proximo_*
     * de todos los planes activos. Idempotente, no crea órdenes ni notifica.
     */
    public function syncTodos(): int
    {
        $total = 0;

        MaintenancePlan::activos()->chunkById(200, function ($planes) use (&$total) {
            foreach ($planes as $plan) {
                $this->recalcularProximo($plan);
                $total++;
            }
        });

        return $total;
    }

    /**
     * Páginas/día estimadas de la impresora: promedio simple entre las dos
     * últimas lecturas; fallback 0 (sin histórico no se estima).
     */
    private function paginasPorDiaEstimadas(Printer $printer): int
    {
        $lecturas = $printer->readings()
            ->orderByDesc('fecha')
            ->limit(2)
            ->get(['valor_contador', 'fecha']);

        if ($lecturas->count() < 2) {
            return 0;
        }

        [$reciente, $anterior] = $lecturas;

        $dias = $anterior->fecha->diffInDays($reciente->fecha);

        if ($dias <= 0) {
            return 0;
        }

        $paginas = max(0, (int) $reciente->valor_contador - (int) $anterior->valor_contador);

        return (int) round($paginas / $dias);
    }
}
