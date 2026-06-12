<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('impresora_id')->constrained('printers')->cascadeOnDelete();
            $table->date('fecha');
            $table->string('tipo_mantto');
            $table->text('desc_problema')->nullable();
            $table->text('trabajo_realizado')->nullable();
            $table->foreignId('proveedor_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->decimal('costo_mano_obra', 12, 2)->default(0);
            $table->decimal('costo_total', 12, 2)->default(0);
            $table->foreignId('socio_id')->constrained('users');
            $table->foreignId('visita_id')->nullable()->constrained('visits')->nullOnDelete();
            $table->string('estado')->default('PROGRAMADA');
            $table->string('estado_anterior_impresora')->nullable();
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();

            $table->index('impresora_id');
            $table->index('fecha');
            $table->index('estado');
            $table->index('proveedor_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_orders');
    }
};
