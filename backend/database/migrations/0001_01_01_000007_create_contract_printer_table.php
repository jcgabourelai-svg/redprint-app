<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contract_printer', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contrato_id')->constrained('contracts')->cascadeOnDelete();
            $table->foreignId('impresora_id')->constrained('printers')->cascadeOnDelete();
            $table->date('fecha_asignacion');
            $table->date('fecha_liberacion')->nullable();
            $table->boolean('activa')->default(true);
            $table->integer('lectura_inicial')->default(0);
            $table->timestamps();

            $table->unique(['contrato_id', 'impresora_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_printer');
    }
};
