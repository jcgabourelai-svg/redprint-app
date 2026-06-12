<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('compra_id')->constrained('purchases')->cascadeOnDelete();
            $table->foreignId('articulo_id')->nullable()->constrained('articles')->nullOnDelete();
            $table->string('articulo_nombre');
            $table->integer('cantidad');
            $table->decimal('costo_unitario', 12, 2);
            $table->decimal('subtotal', 12, 2);

            $table->index('compra_id');
            $table->index('articulo_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_details');
    }
};
