<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // El alias pertenece a la unidad física instalada (pivot
        // contract_printer, único entre asignaciones activas), no al plan
        // de modelos: una fila "N× modelo" no puede expresar un solo alias.
        Schema::table('contract_printer_plan', function (Blueprint $table) {
            $table->dropColumn('alias_sugerido');
        });
    }

    public function down(): void
    {
        Schema::table('contract_printer_plan', function (Blueprint $table) {
            $table->string('alias_sugerido', 60)->nullable();
        });
    }
};
