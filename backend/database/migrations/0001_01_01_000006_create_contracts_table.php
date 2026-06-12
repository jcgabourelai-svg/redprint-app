<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clients')->cascadeOnDelete();
            $table->string('codigo_negocio')->unique();
            $table->date('fecha_inicio');
            $table->date('fecha_fin')->nullable();
            $table->decimal('tarifa_base', 12, 2);
            $table->integer('paginas_incluidas')->default(0);
            $table->decimal('costo_pag_excedente', 12, 4)->default(0);
            $table->integer('dias_gracia')->default(0);
            $table->string('frecuencia_visitas')->default('MENSUAL');
            $table->integer('dias_adelanto')->default(7);
            $table->string('estado')->default('ACTIVO');
            $table->foreignId('creado_por')->constrained('users');
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};
