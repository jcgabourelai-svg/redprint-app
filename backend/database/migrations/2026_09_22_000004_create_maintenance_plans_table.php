<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_plans', function (Blueprint $table) {
            $table->id();
            // Exactamente uno no-null (validado en servicio/request): plan por
            // modelo (default de la flota) o por impresora (override).
            $table->foreignId('printer_model_id')->nullable()->constrained('printer_models')->nullOnDelete();
            $table->foreignId('printer_id')->nullable()->constrained('printers')->nullOnDelete();
            $table->boolean('activo')->default(true);
            $table->integer('periodicidad_meses')->nullable();
            $table->integer('periodicidad_paginas')->nullable();
            $table->integer('ventana_aviso_dias')->default(15);
            $table->date('ultimo_servicio_fecha')->nullable();
            $table->integer('ultimo_servicio_contador')->nullable();
            $table->date('proximo_servicio_fecha')->nullable();
            $table->integer('proximo_servicio_contador')->nullable();
            $table->timestamps();

            $table->index(['activo', 'proximo_servicio_fecha']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_plans');
    }
};
