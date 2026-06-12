<?php

namespace App\Services;

use App\Enums\VisitFrequency;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Contract;
use App\Models\Visit;
use App\Models\Client;
use Carbon\Carbon;

class VisitSchedulerService
{
    public function generateRecurringVisits(Contract $contract, int $creatorId): array
    {
        if (!$contract->fecha_fin && $contract->estado->value !== 'ACTIVO') {
            return [];
        }

        $visits = [];
        $frequency = $contract->frecuencia_visitas;
        $startDate = Carbon::parse($contract->fecha_inicio);
        $endDate = $contract->fecha_fin ? Carbon::parse($contract->fecha_fin) : $startDate->copy()->addMonths(6);

        $nextDate = $this->getNextVisitDate($startDate, $frequency);

        while ($nextDate <= $endDate) {
            $existingVisit = Visit::where('cliente_id', $contract->cliente_id)
                ->where('contrato_id', $contract->id)
                ->where('fecha_programada', $nextDate->format('Y-m-d'))
                ->exists();

            if (!$existingVisit) {
                $visits[] = Visit::create([
                    'cliente_id' => $contract->cliente_id,
                    'contrato_id' => $contract->id,
                    'tipo_visita' => VisitType::LECTURA,
                    'fecha_programada' => $nextDate,
                    'socio_id' => $contract->creado_por,
                    'estado' => VisitStatus::PENDIENTE,
                    'creado_por' => $creatorId,
                    'fecha_creacion' => now(),
                ]);
            }

            $nextDate = $this->getNextVisitDate($nextDate, $frequency);
        }

        return $visits;
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

    private function getNextVisitDate(Carbon $currentDate, VisitFrequency $frequency): Carbon
    {
        return match ($frequency) {
            VisitFrequency::MENSUAL => $currentDate->copy()->addMonth(),
            VisitFrequency::QUINCENAL => $currentDate->copy()->addWeeks(2),
            VisitFrequency::SEMANAL => $currentDate->copy()->addWeek(),
            VisitFrequency::CUSTOM => $currentDate->copy()->addMonth(),
        };
    }
}
