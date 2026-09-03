<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * D22 (arrastre de consumo): `contracts.dias_gracia` se reusa con el
 * significado "dias tras el corte del ciclo en que una lectura tardia aun
 * cierra el ciclo" (antes era "dias de gracia para pago", sin uso en logica
 * de negocio). Default 7 y regularizacion de existentes en 0/null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->integer('dias_gracia')->default(7)->change();
        });

        DB::table('contracts')
            ->whereNull('dias_gracia')
            ->orWhere('dias_gracia', 0)
            ->update(['dias_gracia' => 7]);
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->integer('dias_gracia')->default(0)->change();
        });

        // Revertir tambien el dato (los NULL originales son
        // indistinguibles, quedan en 0: valor sin uso pre-D22).
        DB::table('contracts')
            ->where('dias_gracia', 7)
            ->update(['dias_gracia' => 0]);
    }
};
