<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factura_id')->constrained('invoices')->cascadeOnDelete();
            $table->date('fecha');
            $table->decimal('monto', 12, 2);
            $table->string('metodo_pago');
            $table->text('nota')->nullable();
            $table->foreignId('socio_id')->constrained('users');
            $table->string('comprobante')->nullable();
            $table->foreignId('creado_por')->constrained('users');
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
