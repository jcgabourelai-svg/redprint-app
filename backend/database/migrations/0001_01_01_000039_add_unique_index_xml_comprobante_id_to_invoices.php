<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Refuerza la relacion 1:1 (un CFDI -> a lo sumo una factura) a nivel de
        // base de datos. Los valores NULL no cuentan para UNIQUE en Postgres,
        // por lo que las facturas sin CFDI conviven sin problema.
        Schema::table('invoices', function (Blueprint $table) {
            $table->unique('xml_comprobante_id');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique(['xml_comprobante_id']);
        });
    }
};
