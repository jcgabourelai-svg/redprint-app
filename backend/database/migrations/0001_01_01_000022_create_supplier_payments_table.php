<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supplier_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('compra_id')->constrained('purchases')->cascadeOnDelete();
            $table->date('fecha');
            $table->decimal('monto', 12, 2);
            $table->string('metodo');
            $table->foreignId('socio_id')->constrained('users');
            $table->unsignedBigInteger('cuenta_bancaria_id')->nullable();
            $table->unsignedBigInteger('movimiento_bancario_id')->nullable();
            $table->string('comprobante')->nullable();
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();

            $table->index('compra_id');
            $table->index('fecha');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_payments');
    }
};
