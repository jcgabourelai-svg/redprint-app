<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La factura de doble propósito introduce el estado BORRADOR: un calculo
     * previo a la emision que aun no tiene folio ni fechas. Por eso las
     * columnas de emision pasan a ser nullable.
     *
     * El unique de numero_factura se conserva: Postgres tolera multiples
     * NULL en un indice unique, y los borradores aun no compiten por folio.
     */
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('numero_factura')->nullable()->change();
            $table->date('fecha_emision')->nullable()->change();
            $table->date('fecha_vencimiento')->nullable()->change();
        });
    }

    public function down(): void
    {
        // SET NOT NULL valida las filas existentes: revertir es imposible sin
        // purgar antes los borradores (que legitimamente tienen NULL). Se
        // aborta con un mensaje accionable en lugar del error crudo de PG.
        $conNulos = DB::table('invoices')
            ->whereNull('numero_factura')
            ->orWhereNull('fecha_emision')
            ->orWhereNull('fecha_vencimiento')
            ->exists();

        if ($conNulos) {
            throw new RuntimeException(
                'No se puede revertir la migracion: existen facturas BORRADOR con folio/fechas nulos. ' .
                'Elimina los borradores antes de hacer rollback.'
            );
        }

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('numero_factura')->nullable(false)->change();
            $table->date('fecha_emision')->nullable(false)->change();
            $table->date('fecha_vencimiento')->nullable(false)->change();
        });
    }
};
