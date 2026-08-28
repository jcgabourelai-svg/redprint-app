<?php

use App\Support\PrinterColorPalette;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contract_printer', function (Blueprint $table) {
            $table->string('color', 20)->nullable();
        });

        // Backfill idempotente: por contrato, las asignaciones ACTIVAS sin
        // color reciben la paleta en orden de (fecha_asignacion, id). La
        // unicidad intra-contrato es politica soft (sin indice unico): con
        // mas de 8 activas se reutiliza por modulo. Dataset chico -> loop PHP.
        $keys = PrinterColorPalette::KEYS;

        $contratoIds = DB::table('contract_printer')
            ->where('activa', true)
            ->whereNull('color')
            ->distinct()
            ->pluck('contrato_id');

        foreach ($contratoIds as $contratoId) {
            $ids = DB::table('contract_printer')
                ->where('contrato_id', $contratoId)
                ->where('activa', true)
                ->whereNull('color')
                ->orderBy('fecha_asignacion')
                ->orderBy('id')
                ->pluck('id');

            foreach ($ids as $index => $id) {
                DB::table('contract_printer')
                    ->where('id', $id)
                    ->update(['color' => $keys[$index % count($keys)]]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('contract_printer', function (Blueprint $table) {
            $table->dropColumn('color');
        });
    }
};
