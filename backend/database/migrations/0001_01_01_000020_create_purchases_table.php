<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('proveedor_id')->constrained('suppliers')->cascadeOnDelete();
            $table->date('fecha');
            $table->date('fecha_vto_pago')->nullable();
            $table->string('concepto');
            $table->decimal('monto_total', 12, 2)->default(0);
            $table->decimal('monto_pagado', 12, 2)->default(0);
            $table->decimal('saldo_pendiente', 12, 2)->default(0);
            $table->string('metodo_pago')->nullable();
            $table->string('estado')->default('PENDIENTE');
            $table->string('comprobante')->nullable();
            $table->foreignId('socio_id')->constrained('users');
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();

            $table->index('proveedor_id');
            $table->index('fecha');
            $table->index('estado');
            $table->index('fecha_vto_pago');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};
