<?php

namespace App\Services;

use App\Enums\ContractStatus;
use App\Enums\VisitFrequency;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Contract;
use App\Models\Visit;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class VisitSchedulerService
{
    /**
     * Rolling horizon: solo se genera la proxima visita dentro de esta ventana
     * (1 mes por delante desde hoy).
     */
    public const ROLLING_MONTHS = 1;

    /**
     * Recorre los contratos ACTIVOS (en chunks para no saturar memoria) y genera
     * la proxima visita recurrente (rolling) si corresponde dentro de la ventana
     * de 1 mes. Las consultas de visita existentes se hacen en lote por chunk.
     *
     * @return Visit[] Visitas creadas en esta pasada.
     */
    public function generateRecurringVisits(): array
    {
        $created = [];
        $horizonEnd = today()->addMonthsNoOverflow(self::ROLLING_MONTHS)->endOfDay();

        $this->activeContracts()->chunkById(200, function ($contracts) use (&$created, $horizonEnd) {
            $contractIds = $contracts->pluck('id');

            // Batch fetch: todas las visitas LECTURA no-CANCELADA de este chunk
            // dentro de la ventana rolling, en una sola consulta.
            $existingVisits = Visit::whereIn('contrato_id', $contractIds)
                ->where('tipo_visita', VisitType::LECTURA)
                ->where('fecha_programada', '>=', today())
                ->where('fecha_programada', '<=', $horizonEnd->toDateString())
                ->where('estado', '!=', VisitStatus::CANCELADA)
                ->get(['contrato_id', 'cliente_id', 'fecha_programada', 'estado'])
                ->groupBy('contrato_id');

            foreach ($contracts as $contract) {
                $visit = $this->generateNextCycle(
                    $contract,
                    null,
                    $existingVisits->get($contract->id, collect())
                );
                if ($visit !== null) {
                    $created[] = $visit;
                }
            }
        });

        return $created;
    }

    /**
     * Query builder de contratos ACTIVOS vigentes (sin fecha_fin o con
     * fecha_fin >= hoy), seleccionando solo las columnas necesarias.
     */
    public function activeContracts()
    {
        return Contract::select([
                'id', 'cliente_id', 'fecha_inicio', 'fecha_fin',
                'frecuencia_visitas', 'dia_visita', 'creado_por', 'estado',
            ])
            ->where('estado', ContractStatus::ACTIVO)
            ->where(function ($q) {
                $q->whereNull('fecha_fin')->orWhere('fecha_fin', '>=', today());
            });
    }

    /**
     * Genera SOLO la proxima visita LECTURA para el contrato, dentro de la
     * ventana rolling de 1 mes, si aun no existe una visita pendiente en esa
     * ventana. Idempotente (guard anticopia por contrato_id + fecha_programada).
     */
    public function generateNextCycle(Contract $contract, ?int $creatorId = null, ?Collection $cachedVisits = null): ?Visit
    {
        if ($contract->estado !== ContractStatus::ACTIVO) {
            return null;
        }

        if ($contract->fecha_fin && $contract->fecha_fin->isBefore(today())) {
            return null;
        }

        $horizonEnd = today()->addMonthsNoOverflow(self::ROLLING_MONTHS)->endOfDay();

        // Si ya existe una visita LECTURA pendiente u omitida dentro de la
        // ventana, no se crea nada (rolling: solo se mantiene 1 mes por delante).
        // Las visitas OMITIDA (cancelacion manual individual) ocupan el slot para
        // que el cron no las regenere, a diferencia de CANCELADA (contractual).
        if ($cachedVisits !== null) {
            $hasUpcoming = $cachedVisits->contains(
                fn ($v) => in_array($v->estado, [VisitStatus::PENDIENTE, VisitStatus::OMITIDA], true)
            );
        } else {
            $hasUpcoming = Visit::where('contrato_id', $contract->id)
                ->where('cliente_id', $contract->cliente_id)
                ->whereIn('estado', [VisitStatus::PENDIENTE, VisitStatus::OMITIDA])
                ->where('tipo_visita', VisitType::LECTURA)
                ->where('fecha_programada', '>=', today())
                ->where('fecha_programada', '<=', $horizonEnd->toDateString())
                ->exists();
        }

        if ($hasUpcoming) {
            return null;
        }

        $nextDate = $this->computeNextVisitDate($contract, today());

        if ($nextDate === null) {
            return null;
        }

        // Si la proxima fecha cae fuera de la ventana rolling, no generar aun.
        if ($nextDate->gt($horizonEnd)) {
            return null;
        }

        // Si el contrato tiene fecha fin y la visita cae despues, no generar.
        if ($contract->fecha_fin && $nextDate->gt($contract->fecha_fin)) {
            return null;
        }

        // Guard anticopia por contrato_id + fecha_programada + cliente_id.
        // Se excluyen solo las CANCELADA (contractual) para que no bloqueen la
        // regeneracion tras reactivar un contrato. Las OMITIDA (manual) SI
        // bloquean para respetar la cancelacion individual del usuario.
        if ($cachedVisits !== null) {
            $exists = $cachedVisits->contains(
                fn ($v) => $v->fecha_programada->toDateString() === $nextDate->toDateString()
            );
        } else {
            $exists = Visit::where('contrato_id', $contract->id)
                ->where('cliente_id', $contract->cliente_id)
                ->where('fecha_programada', $nextDate->toDateString())
                ->where('estado', '!=', VisitStatus::CANCELADA)
                ->exists();
        }

        if ($exists) {
            return null;
        }

        return Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => VisitType::LECTURA,
            'fecha_programada' => $nextDate,
            'socio_id' => $creatorId ?? $contract->creado_por,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $creatorId ?? $contract->creado_por,
            'fecha_creacion' => now(),
        ]);
    }

    /**
     * Marca como CANCELADA todas las visitas PENDIENTES del contrato (incluidas
     * las atrasadas). No las borra. Devuelve la cantidad afectada.
     */
    public function cancelFutureVisits(Contract $contract): int
    {
        return Visit::where('contrato_id', $contract->id)
            ->where('estado', VisitStatus::PENDIENTE)
            ->update(['estado' => VisitStatus::CANCELADA]);
    }

    /**
     * Calcula la proxima fecha de visita a partir de $reference:
     *  - MENSUAL: dia_visita (con clamp de mes corto) o derivado desde fecha_inicio.
     *  - QUINCENAL: +2 semanas desde fecha_inicio (o desde hoy).
     *  - SEMANAL: +1 semana desde fecha_inicio (o desde hoy).
     *  - CUSTOM: +1 mes por defecto.
     *
     * Para MENSUAL con dia_visita, el dia se proyecta sobre el proximo mes
     * donde aun no se paso esa fecha respecto a $reference.
     *
     * D21: si el contrato aun no inicia (fecha_inicio >= $reference), la
     * primera visita LECTURA nace a +1 periodo del inicio (primera ocurrencia
     * de la cadencia estrictamente posterior a fecha_inicio), nunca el mismo
     * dia del alta: evita la lectura cero del dia 1.
     */
    public function computeNextVisitDate(Contract $contract, Carbon $reference): ?Carbon
    {
        $frequency = $contract->frecuencia_visitas;
        $diaVisita = $contract->dia_visita;

        $anchor = $contract->fecha_inicio
            ? Carbon::instance($contract->fecha_inicio)
            : $reference->copy();

        if ($frequency === VisitFrequency::MENSUAL && $diaVisita !== null) {
            // Contrato no iniciado: primera ocurrencia de dia_visita despues
            // de fecha_inicio (con clamp de mes corto).
            if ($anchor->startOfDay()->gte($reference->copy()->startOfDay())) {
                return $this->nextMonthlyDate((int) $diaVisita, $anchor->copy()->addDay());
            }

            return $this->nextMonthlyDate((int) $diaVisita, $reference);
        }

        // Para SEMANAL/QUINCENAL se avanza desde fecha_inicio a saltos fijos.
        // Se calcula el proximo salto >= hoy en O(1) en lugar de iterar semana
        // a semana (los contratos semanales largos generarian cientos/miles de
        // iteraciones en cada corrida del cron).
        $stepDays = match ($frequency) {
            VisitFrequency::QUINCENAL => 14,
            VisitFrequency::SEMANAL => 7,
            default => null,
        };

        if ($stepDays !== null) {
            // diff con signo: negativo si fecha_inicio esta en el futuro.
            $diff = (int) $anchor->startOfDay()->diffInDays($reference->copy()->startOfDay(), false);
            if ($diff <= 0) {
                // Contrato no iniciado (o inicio hoy): +1 periodo desde el
                // inicio, nunca el mismo dia del alta (D21).
                return $anchor->copy()->addDays($stepDays);
            }
            $steps = (int) ceil($diff / $stepDays);
            $next = $anchor->copy()->addDays($steps * $stepDays);
            if ($next->lt($reference)) {
                $next = $next->copy()->addDays($stepDays);
            }
            return $next;
        }

        // MENSUAL/CUSTOM: avanza de mes en mes en O(1) usando diffInMonths.
        if ($anchor->gte($reference)) {
            // Contrato no iniciado (o inicio hoy): +1 mes desde el inicio (D21).
            return $anchor->copy()->addMonthNoOverflow();
        }
        $months = (int) ceil($anchor->floatDiffInMonths($reference));
        $next = $anchor->copy()->addMonthsNoOverflow($months);
        if ($next->lt($reference)) {
            $next = $next->copy()->addMonthNoOverflow();
        }

        return $next;
    }

    /**
     * Proyecta diaVisita sobre el mes de $reference; si ya paso, avanza al mes
     * siguiente. Clamp al ultimo dia del mes si diaVisita excede los dias del mes.
     */
    private function nextMonthlyDate(int $diaVisita, Carbon $reference): Carbon
    {
        $candidate = $this->clampDayOfMonth($reference->year, $reference->month, $diaVisita);

        if ($candidate->lt($reference)) {
            $next = $reference->copy()->addMonthNoOverflow();
            $candidate = $this->clampDayOfMonth($next->year, $next->month, $diaVisita);
        }

        return $candidate;
    }

    private function clampDayOfMonth(int $year, int $month, int $day): Carbon
    {
        $lastDay = (int) Carbon::createFromDate($year, $month, 1)->endOfMonth()->day;

        return Carbon::createFromDate($year, $month, min($day, $lastDay))->startOfDay();
    }

    public function checkUpcomingAlerts(int $daysAhead = 7): array
    {
        $alerts = [];

        $upcomingVisits = Visit::with(['client', 'contract'])
            ->where('estado', VisitStatus::PENDIENTE)
            ->whereBetween('fecha_programada', [now(), now()->addDays($daysAhead)])
            ->get();

        foreach ($upcomingVisits as $visit) {
            $alerts[] = [
                'type' => 'upcoming_visit',
                'visit_id' => $visit->id,
                'client' => $visit->client->razon_social,
                'date' => $visit->fecha_programada->format('Y-m-d'),
            ];
        }

        return $alerts;
    }

    public function detectClientsWithoutVisit(): array
    {
        $activeContracts = Contract::where('estado', 'ACTIVO')->with('client')->get();

        $missing = [];
        foreach ($activeContracts as $contract) {
            $hasPendingVisit = Visit::where('cliente_id', $contract->cliente_id)
                ->where('contrato_id', $contract->id)
                ->where('estado', VisitStatus::PENDIENTE)
                ->whereMonth('fecha_programada', '>=', now()->month)
                ->exists();

            if (!$hasPendingVisit) {
                $missing[] = [
                    'client_id' => $contract->cliente_id,
                    'client' => $contract->client->razon_social,
                    'contract_id' => $contract->id,
                    'contract_code' => $contract->codigo_negocio,
                ];
            }
        }

        return $missing;
    }
}
