<?php

namespace App\Console\Commands;

use App\Services\MaintenancePlanService;
use Illuminate\Console\Command;

class SyncMaintenancePlans extends Command
{
    protected $signature = 'maintenance:sync-plans';

    protected $description = 'Recalcula proximo_servicio_* de todos los planes preventivos activos (backfill diario, idempotente). No crea órdenes ni notifica.';

    public function handle(MaintenancePlanService $service): int
    {
        $total = $service->syncTodos();

        $this->info("Planes preventivos recalculados: {$total}");

        return self::SUCCESS;
    }
}
