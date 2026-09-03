<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Falla con diagnóstico antes de tocar el índice si la carrera de
        // concurrencia del check-then-insert llegó a producir duplicados.
        $duplicados = DB::table('contract_printer')
            ->whereNotNull('reemplaza_a')
            ->selectRaw('reemplaza_a, count(*) as total')
            ->groupBy('reemplaza_a')
            ->havingRaw('count(*) > 1')
            ->pluck('reemplaza_a');

        if ($duplicados->isNotEmpty()) {
            throw new \RuntimeException(
                'No se puede crear contract_printer_reemplaza_a_unique: hay asignaciones '
                . 'liberadas enlazadas por más de una instalación (reemplaza_a: '
                . $duplicados->implode(', ') . '). Corrige los duplicados antes de migrar.'
            );
        }

        // Integridad de la genealogía de sustituciones: una fila liberada
        // solo puede ser reemplazada por UNA instalación (mismo patrón de
        // índice parcial que contract_printer_contrato_impresora_active_unique).
        // Backstop de concurrencia del guard en ContractService::assignPrinter.
        DB::statement(
            'CREATE UNIQUE INDEX IF NOT EXISTS contract_printer_reemplaza_a_unique '
            . 'ON contract_printer (reemplaza_a) '
            . 'WHERE reemplaza_a IS NOT NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS contract_printer_reemplaza_a_unique');
    }
};
