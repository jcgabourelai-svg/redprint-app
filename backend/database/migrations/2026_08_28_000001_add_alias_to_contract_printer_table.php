<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contract_printer', function (Blueprint $table) {
            $table->string('alias', 60)->nullable();
        });

        // Indice unico parcial: dentro de un contrato, un alias ("Recepcion",
        // "Taller"...) solo puede estar en uso por una asignacion ACTIVA a la
        // vez. Las filas liberadas conservan su alias como evidencia historica
        // y no cuentan para la unicidad; multiple alias NULL quedan excluidos.
        DB::statement(
            'CREATE UNIQUE INDEX IF NOT EXISTS contract_printer_alias_active_unique '
            . 'ON contract_printer (contrato_id, alias) '
            . 'WHERE activa = true AND alias IS NOT NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS contract_printer_alias_active_unique');

        Schema::table('contract_printer', function (Blueprint $table) {
            $table->dropColumn('alias');
        });
    }
};
