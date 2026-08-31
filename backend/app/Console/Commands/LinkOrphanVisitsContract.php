<?php

namespace App\Console\Commands;

use App\Enums\ContractStatus;
use App\Enums\VisitStatus;
use App\Models\Contract;
use App\Models\Visit;
use Illuminate\Console\Command;

class LinkOrphanVisitsContract extends Command
{
    protected $signature = 'visits:vincular-contratos-huerfanos {--execute : Aplica los cambios (por defecto solo muestra el dry-run)}';

    protected $description = 'Vincula contrato_id en visitas pendientes/reprogramadas huérfanas cuando el cliente tiene exactamente 1 contrato activo';

    public function handle(): int
    {
        $execute = (bool) $this->option('execute');

        $visits = Visit::query()
            ->whereNull('contrato_id')
            ->whereIn('estado', [VisitStatus::PENDIENTE, VisitStatus::REPROGRAMADA])
            ->with('client:id,razon_social')
            ->orderBy('id')
            ->get();

        if ($visits->isEmpty()) {
            $this->info('No hay visitas huérfanas (sin contrato) pendientes o reprogramadas.');
            return self::SUCCESS;
        }

        $this->info(($execute ? 'EJECUTANDO' : 'DRY-RUN') . " reparación de {$visits->count()} visita(s) huérfana(s):");

        $vinculadas = 0;
        $requierenAtencion = [];

        foreach ($visits as $visit) {
            $activos = Contract::where('cliente_id', $visit->cliente_id)
                ->where('estado', ContractStatus::ACTIVO->value)
                ->orderBy('id')
                ->get(['id', 'codigo_negocio']);

            if ($activos->count() === 1) {
                $contract = $activos->first();

                if ($execute) {
                    $visit->update(['contrato_id' => $contract->id]);
                }

                $vinculadas++;
                $this->line(sprintf(
                    '  %s Visita %d (%s, %s) -> contrato %d [%s]',
                    $execute ? '+' : '~',
                    $visit->id,
                    $visit->client?->razon_social ?? "cliente {$visit->cliente_id}",
                    $visit->tipo_visita?->value,
                    $contract->id,
                    $contract->codigo_negocio,
                ));
            } else {
                $requierenAtencion[] = $visit;
                $this->warn(sprintf(
                    '  ! Visita %d (%s, %s): el cliente tiene %d contrato(s) activo(s), requiere atención manual',
                    $visit->id,
                    $visit->client?->razon_social ?? "cliente {$visit->cliente_id}",
                    $visit->tipo_visita?->value,
                    $activos->count(),
                ));
            }
        }

        $this->newLine();
        $this->table(
            ['Concepto', 'Total'],
            [
                ['Visitas revisadas', $visits->count()],
                ['Vinculadas' . ($execute ? '' : ' (dry-run, sin cambios)'), $vinculadas],
                ['Requieren atención manual', count($requierenAtencion)],
            ],
        );

        if (!$execute && $vinculadas > 0) {
            $this->newLine();
            $this->line('Dry-run: no se modificaron datos. Ejecuta con --execute para aplicar los cambios.');
        }

        return self::SUCCESS;
    }
}
