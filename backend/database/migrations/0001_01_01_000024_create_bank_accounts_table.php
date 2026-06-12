<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->id();
            $table->enum('banco', ['BANCOMER', 'BANAMEX', 'SANTANDER', 'BBVA', 'HSBC', 'OTRO'])->default('OTRO');
            $table->enum('tipo_cuenta', ['CHEQUES', 'DEBITO', 'AHORRO'])->default('CHEQUES');
            $table->string('numero_cuenta')->unique();
            $table->enum('moneda', ['MXN', 'USD'])->default('MXN');
            $table->decimal('saldo', 10, 2)->default(0);
            $table->decimal('saldo_inicial', 10, 2)->default(0);
            $table->text('descripcion')->nullable();
            $table->boolean('activo')->default(true);
            $table->foreignId('socio_id')->nullable()->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_accounts');
    }
};
