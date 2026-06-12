<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cuenta_bancaria_id')->constrained('bank_accounts');
            $table->enum('tipo', ['DEPOSITO', 'RETIRO']);
            $table->decimal('monto', 10, 2);
            $table->string('referencia')->nullable();
            $table->text('descripcion')->nullable();
            $table->enum('conciliacion_status', ['PENDIENTE', 'CONCILIADO', 'NO_CONCILIADO'])->default('PENDIENTE');
            $table->foreignId('transaccion_vinculada_id')->nullable();
            $table->string('categoria')->nullable();
            $table->date('fecha');
            $table->foreignId('socio_id')->nullable()->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_movements');
    }
};
