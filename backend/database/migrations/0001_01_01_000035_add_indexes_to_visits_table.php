<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // CREATE INDEX CONCURRENTLY no puede ejecutarse dentro de una transaccion.
    public $withinTransaction = false;

    public function up(): void
    {
        DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS visits_contrato_fecha_index ON visits (contrato_id, fecha_programada)');
        DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS visits_fecha_estado_index ON visits (fecha_programada, estado)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS visits_contrato_fecha_index');
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS visits_fecha_estado_index');
    }
};
