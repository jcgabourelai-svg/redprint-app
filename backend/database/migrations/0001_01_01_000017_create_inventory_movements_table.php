<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('articulo_id')->constrained('articles')->cascadeOnDelete();
            $table->string('tipo_movimiento');
            $table->integer('cantidad');
            $table->integer('stock_anterior');
            $table->integer('stock_posterior');
            $table->string('referencia_tipo')->nullable();
            $table->unsignedBigInteger('referencia_id')->nullable();
            $table->text('justificacion')->nullable();
            $table->date('fecha');
            $table->foreignId('socio_id')->constrained('users');
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();

            $table->index('articulo_id');
            $table->index('fecha');
            $table->index(['referencia_tipo', 'referencia_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
    }
};
