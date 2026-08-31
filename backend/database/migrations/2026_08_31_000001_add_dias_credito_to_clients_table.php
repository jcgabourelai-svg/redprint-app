<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Dias de credito del cliente: base para derivar la fecha de vencimiento
     * de una factura (fecha_emision + dias_credito). Ya no es input libre.
     */
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->integer('dias_credito')->default(30);
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn('dias_credito');
        });
    }
};
