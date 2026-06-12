<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('factura_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('contrato_id')->nullable()->constrained('contracts')->nullOnDelete();
            $table->foreignId('impresora_id')->nullable()->constrained('printers')->nullOnDelete();
            $table->foreignId('lectura_id')->nullable()->constrained('readings')->nullOnDelete();
            $table->integer('paginas_consumidas')->default(0);
            $table->decimal('monto_calculado', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_details');
    }
};
