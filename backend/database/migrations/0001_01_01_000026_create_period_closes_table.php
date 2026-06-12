<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('period_closes', function (Blueprint $table) {
            $table->id();
            $table->string('periodo')->unique();
            $table->enum('estado', ['abierto', 'cerrado'])->default('abierto');
            $table->date('fecha_cierre')->nullable();
            $table->foreignId('cerrado_por')->nullable()->constrained('users');
            $table->decimal('ingresos', 10, 2)->default(0);
            $table->decimal('egresos', 10, 2)->default(0);
            $table->decimal('rentabilidad', 10, 2)->default(0);
            $table->integer('facturas_emitidas')->default(0);
            $table->integer('facturas_pagadas')->default(0);
            $table->integer('facturas_pendientes')->default(0);
            $table->decimal('gastos_registrados', 10, 2)->default(0);
            $table->integer('movimientos_bancarios')->default(0);
            $table->integer('movimientos_conciliados')->default(0);
            $table->integer('movimientos_pendientes')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('period_closes');
    }
};
