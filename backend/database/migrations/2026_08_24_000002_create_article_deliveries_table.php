<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('article_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('articulo_id')->constrained('articles')->cascadeOnDelete();
            $table->foreignId('visita_id')->constrained('visits')->cascadeOnDelete();
            $table->foreignId('contrato_id')->nullable()->constrained('contracts')->nullOnDelete();
            $table->foreignId('cliente_id')->constrained('clients')->cascadeOnDelete();
            $table->integer('cantidad');
            // Snapshot de costos al momento de la entrega (patron articles_used).
            $table->decimal('costo_unitario', 12, 2);
            $table->decimal('subtotal', 12, 2);
            $table->foreignId('socio_id')->constrained('users');
            $table->string('notas')->nullable();
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();

            $table->index('articulo_id');
            $table->index('visita_id');
            $table->index('cliente_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('article_deliveries');
    }
};
