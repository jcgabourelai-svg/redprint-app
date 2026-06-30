<?php

namespace App\Console\Commands;

use App\Services\VisitSchedulerService;
use Illuminate\Console\Command;

class GenerateUpcomingVisits extends Command
{
    protected $signature = 'visits:generate-upcoming';

    protected $description = 'Genera las proximas visitas recurrentes (rolling, 1 mes) para contratos activos';

    public function handle(VisitSchedulerService $scheduler): int
    {
        $this->info('Generando visitas recurrentes (rolling)...');

        $created = $scheduler->generateRecurringVisits();

        foreach ($created as $visit) {
            $this->line("  + Contrato {$visit->contrato_id}: visita {$visit->fecha_programada->toDateString()}");
        }

        $this->info('Visitas creadas: ' . count($created));

        return self::SUCCESS;
    }
}
