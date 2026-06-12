<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('printers', function (Blueprint $table) {
            $table->id();
            $table->string('marca');
            $table->string('modelo');
            $table->string('num_serie')->unique();
            $table->date('fecha_adquisicion');
            $table->decimal('costo_adquisicion', 12, 2)->nullable();
            $table->string('codigo_negocio')->unique();
            $table->integer('vida_util_meses')->nullable();
            $table->string('estado')->default('EN_ALMACEN');
            $table->foreignId('almacen_id')->nullable()->constrained('warehouses')->nullOnDelete();
            $table->integer('contador_actual')->default(0);
            $table->foreignId('creado_por')->constrained('users');
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('printers');
    }
};
