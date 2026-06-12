<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            $table->string('tipo_articulo');
            $table->string('subtipo')->nullable();
            $table->string('nombre');
            $table->string('marca')->nullable();
            $table->string('modelo_sku')->nullable();
            $table->integer('stock_actual')->default(0);
            $table->integer('umbral_reposicion')->default(5);
            $table->decimal('costo_unitario', 12, 2)->default(0);
            $table->foreignId('proveedor_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->json('impresoras_compatibles')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();

            $table->index('stock_actual');
            $table->index('umbral_reposicion');
            $table->index('proveedor_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles');
    }
};
