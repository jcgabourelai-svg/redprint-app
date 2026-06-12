<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cliente_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('contrato_id')->nullable()->constrained('contracts')->nullOnDelete();
            $table->string('tipo_visita')->default('LECTURA');
            $table->date('fecha_programada');
            $table->timestamp('fecha_realizada')->nullable();
            $table->foreignId('socio_id')->constrained('users');
            $table->string('estado')->default('PENDIENTE');
            $table->text('notas')->nullable();
            $table->foreignId('creado_por')->constrained('users');
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visits');
    }
};
