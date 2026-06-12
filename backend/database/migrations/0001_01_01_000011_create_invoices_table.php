<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('numero_factura')->unique();
            $table->foreignId('cliente_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('contrato_id')->nullable()->constrained('contracts')->nullOnDelete();
            $table->date('fecha_emision');
            $table->date('fecha_vencimiento');
            $table->date('periodo_inicio')->nullable();
            $table->date('periodo_fin')->nullable();
            $table->decimal('monto_total', 12, 2);
            $table->decimal('monto_pagado', 12, 2)->default(0);
            $table->decimal('saldo_pendiente', 12, 2);
            $table->string('estado')->default('PENDIENTE');
            $table->text('notas')->nullable();
            $table->foreignId('socio_id')->constrained('users');
            $table->string('comprobante')->nullable();
            $table->foreignId('creado_por')->constrained('users');
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
