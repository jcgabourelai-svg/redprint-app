<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('printer_expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('impresora_id')->constrained('printers')->cascadeOnDelete();
            $table->string('tipo');
            $table->decimal('monto', 12, 2);
            $table->date('fecha');
            $table->text('descripcion')->nullable();
            $table->foreignId('socio_id')->constrained('users');
            $table->foreignId('orden_mantto_id')->nullable()->constrained('maintenance_orders')->nullOnDelete();
            $table->unsignedBigInteger('cuenta_bancaria_id')->nullable();
            $table->string('comprobante')->nullable();
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();

            $table->index('impresora_id');
            $table->index('fecha');
            $table->index('tipo');
            $table->index('orden_mantto_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('printer_expenses');
    }
};
