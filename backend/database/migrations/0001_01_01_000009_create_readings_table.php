<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('readings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visita_id')->constrained('visits')->cascadeOnDelete();
            $table->foreignId('impresora_id')->constrained('printers')->cascadeOnDelete();
            $table->foreignId('contrato_id')->nullable()->constrained('contracts')->nullOnDelete();
            $table->date('fecha');
            $table->integer('valor_contador');
            $table->integer('paginas_periodo')->default(0);
            $table->foreignId('socio_id')->constrained('users');
            $table->string('foto_evidencia')->nullable();
            $table->text('justificacion_anomalia')->nullable();
            $table->boolean('es_anomalia')->default(false);
            $table->decimal('ubicacion_lat', 10, 7)->nullable();
            $table->decimal('ubicacion_lng', 10, 7)->nullable();
            $table->foreignId('creado_por')->constrained('users');
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('readings');
    }
};
