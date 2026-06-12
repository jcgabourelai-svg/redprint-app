<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clients', function (Blueprint $table) {
            $table->id();
            $table->string('razon_social');
            $table->string('rfc')->nullable();
            $table->string('nombre_contacto');
            $table->string('telefono');
            $table->string('correo')->nullable();
            $table->text('direccion_instalacion');
            $table->text('notas')->nullable();
            $table->foreignId('creado_por')->constrained('users');
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
