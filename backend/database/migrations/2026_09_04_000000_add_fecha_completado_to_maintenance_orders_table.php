<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenance_orders', function (Blueprint $table) {
            $table->timestamp('fecha_completado')->nullable()->after('fecha_creacion');
        });

        // Backfill aproximado para órdenes COMPLETADAs históricas: no existía
        // el dato, se toma la última edición como mejor aproximación.
        DB::table('maintenance_orders')
            ->where('estado', 'COMPLETADA')
            ->whereNull('fecha_completado')
            ->update(['fecha_completado' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('maintenance_orders', function (Blueprint $table) {
            $table->dropColumn('fecha_completado');
        });
    }
};
