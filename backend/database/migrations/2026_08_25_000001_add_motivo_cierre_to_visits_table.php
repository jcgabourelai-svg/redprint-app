<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            // Motivo obligatorio al cerrar una visita sin actividades registradas.
            $table->text('motivo_cierre')->nullable()->after('notas');
        });
    }

    public function down(): void
    {
        Schema::table('visits', function (Blueprint $table) {
            $table->dropColumn('motivo_cierre');
        });
    }
};
