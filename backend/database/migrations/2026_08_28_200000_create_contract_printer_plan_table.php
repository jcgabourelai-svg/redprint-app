<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contract_printer_plan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contrato_id')->constrained('contracts')->cascadeOnDelete();
            $table->foreignId('printer_model_id')->constrained('printer_models')->restrictOnDelete();
            $table->unsignedTinyInteger('cantidad');
            $table->string('alias_sugerido', 60)->nullable();
            $table->timestamps();

            $table->unique(['contrato_id', 'printer_model_id']);
        });

        // Backfill D-I: por contrato, agrupar asignaciones ACTIVAS por modelo
        // catalogado (series sin printer_model_id quedan fuera del plan) e
        // insertar una fila de plan con cantidad = count. Idempotente por el
        // unique (contrato_id, printer_model_id) + insertOrIgnore.
        $filas = DB::table('contract_printer as cp')
            ->join('printers as p', 'p.id', '=', 'cp.impresora_id')
            ->where('cp.activa', true)
            ->whereNotNull('p.printer_model_id')
            ->selectRaw('cp.contrato_id, p.printer_model_id, COUNT(*) as cantidad')
            ->groupBy('cp.contrato_id', 'p.printer_model_id')
            ->get();

        foreach ($filas as $fila) {
            DB::table('contract_printer_plan')->insertOrIgnore([
                'contrato_id' => $fila->contrato_id,
                'printer_model_id' => $fila->printer_model_id,
                'cantidad' => min((int) $fila->cantidad, 255),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_printer_plan');
    }
};
