<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('printer_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('impresora_id')->constrained('printers')->cascadeOnDelete();
            $table->string('tipo_evento');
            $table->text('descripcion')->nullable();
            $table->json('datos_adicionales')->nullable();
            $table->foreignId('socio_id')->constrained('users');
            $table->timestamp('fecha')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('printer_histories');
    }
};
