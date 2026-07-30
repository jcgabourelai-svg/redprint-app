<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Reparacion defensiva: si existieran lecturas facturadas mas de una
        // vez (posible por la ausencia previa de unicidad), conservar el
        // detalle mas antiguo (MIN(id)) por lectura_id y eliminar los
        // duplicados, de modo que el indice unico pueda crearse. Como la
        // columna lectura_id solo empezara a poblarse con esta funcionalidad,
        // en la practica no deberia haber duplicados; esto es una salvaguarda.
        $duplicados = DB::table('invoice_details')
            ->select('lectura_id', DB::raw('MIN(id) as mantener_id'))
            ->whereNotNull('lectura_id')
            ->groupBy('lectura_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicados as $dup) {
            DB::table('invoice_details')
                ->where('lectura_id', $dup->lectura_id)
                ->where('id', '!=', $dup->mantener_id)
                ->delete();
        }

        // Indice unico parcial: una lectura facturable puede figurar en
        // invoice_details a lo sumo una vez. Las filas con lectura_id NULL
        // (renta base sin lectura) quedan excluidas y permiten duplicados.
        DB::statement(
            'CREATE UNIQUE INDEX IF NOT EXISTS invoice_details_lectura_id_unique '
            . 'ON invoice_details (lectura_id) WHERE lectura_id IS NOT NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS invoice_details_lectura_id_unique');
    }
};
