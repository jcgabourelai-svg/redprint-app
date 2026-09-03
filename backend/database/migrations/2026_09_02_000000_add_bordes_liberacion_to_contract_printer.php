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
            $table->unsignedInteger('lectura_final')->nullable();
            $table->date('fecha_lectura_final')->nullable();
            $table->string('motivo_liberacion', 30)->nullable();
            $table->text('justificacion_sin_lectura')->nullable();
            $table->foreignId('reemplaza_a')->nullable()
                ->constrained('contract_printer')->nullOnDelete();
        });

        // La lectura de cierre del retiro puede crearse sin visita asociada
        // (retiro desde web, finalización/cancelación de contrato).
        Schema::table('readings', function (Blueprint $table) {
            $table->foreignId('visita_id')->nullable()->change();
        });

        // El unique total (contrato_id, impresora_id) impide re-asignar la
        // misma impresora al mismo contrato (p. ej. tras taller). Se cambia por
        // un indice parcial: solo una fila ACTIVA por par; las ventanas
        // historicas liberadas pueden coexistir (mismo patrón que
        // contract_printer_alias_active_unique). En Postgres el unique de
        // Laravel es un CONSTRAINT (su indice no se puede dropear solo).
        DB::statement(
            'ALTER TABLE contract_printer DROP CONSTRAINT IF EXISTS contract_printer_contrato_id_impresora_id_unique'
        );

        DB::statement(
            'CREATE UNIQUE INDEX IF NOT EXISTS contract_printer_contrato_impresora_active_unique '
            . 'ON contract_printer (contrato_id, impresora_id) '
            . 'WHERE activa = true'
        );
    }

    public function down(): void
    {
        Schema::table('readings', function (Blueprint $table) {
            $table->foreignId('visita_id')->nullable(false)->change();
        });

        DB::statement('DROP INDEX IF EXISTS contract_printer_contrato_impresora_active_unique');

        DB::statement(
            'CREATE UNIQUE INDEX IF NOT EXISTS contract_printer_contrato_id_impresora_id_unique '
            . 'ON contract_printer (contrato_id, impresora_id)'
        );

        Schema::table('contract_printer', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reemplaza_a');
            $table->dropColumn([
                'justificacion_sin_lectura',
                'motivo_liberacion',
                'fecha_lectura_final',
                'lectura_final',
            ]);
        });
    }
};
