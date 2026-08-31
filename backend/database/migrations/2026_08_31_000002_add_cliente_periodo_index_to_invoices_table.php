<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Soporta el detector de solapamiento de periodos y los listados por
     * cliente: Postgres no indexa automaticamente las columnas de FK, y sin
     * este indice cada calculo/recalculo escanea toda la tabla invoices.
     */
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->index(['cliente_id', 'periodo_inicio'], 'invoices_cliente_periodo_index');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex('invoices_cliente_periodo_index');
        });
    }
};
