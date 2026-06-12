<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('articles_used', function (Blueprint $table) {
            $table->id();
            $table->foreignId('articulo_id')->constrained('articles')->cascadeOnDelete();
            $table->foreignId('orden_mantto_id')->constrained('maintenance_orders')->cascadeOnDelete();
            $table->integer('cantidad');
            $table->decimal('costo_unitario', 12, 2);
            $table->decimal('subtotal', 12, 2);

            $table->index('articulo_id');
            $table->index('orden_mantto_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles_used');
    }
};
