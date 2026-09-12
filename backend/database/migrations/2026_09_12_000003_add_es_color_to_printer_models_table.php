<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('printer_models', function (Blueprint $table) {
            $table->boolean('es_color')->default(false)->after('nombre');
        });

        $this->backfillEsColor();
    }

    /**
     * Backfill por heuristica sobre el pivote ya catalogado: un modelo con
     * toners Ciano/Magenta/Amarillo vinculados es una impresora color. El
     * catalogo puede corregirse luego via la API (PUT es_color).
     */
    private function backfillEsColor(): void
    {
        $colorModelIds = DB::table('article_printer_model as apm')
            ->join('articles as a', 'a.id', '=', 'apm.article_id')
            ->where('a.subtipo', 'TONER')
            ->where(fn ($q) => $q->where('a.nombre', 'ilike', '%ciano%')
                ->orWhere('a.nombre', 'ilike', '%magenta%')
                ->orWhere('a.nombre', 'ilike', '%amarillo%'))
            ->pluck('apm.printer_model_id')
            ->unique()
            ->values();

        if ($colorModelIds->isNotEmpty()) {
            DB::table('printer_models')->whereIn('id', $colorModelIds)->update(['es_color' => true]);
        }

        Log::info(
            "[migration es_color] {$colorModelIds->count()} modelo(s) marcados como color por el backfill del pivote article_printer_model."
        );
    }

    public function down(): void
    {
        Schema::table('printer_models', function (Blueprint $table) {
            $table->dropColumn('es_color');
        });
    }
};
