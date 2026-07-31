<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('xml_conceptos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('xml_comprobante_id')
                ->constrained('xml_comprobantes')
                ->cascadeOnDelete();
            $table->string('clave_prod_serv')->nullable();
            $table->string('no_identificacion')->nullable();
            $table->decimal('cantidad', 12, 4);
            $table->string('clave_unidad')->nullable();
            $table->string('unidad')->nullable();
            $table->text('descripcion');
            $table->decimal('valor_unitario', 12, 2)->nullable();
            $table->decimal('importe', 12, 2);
            $table->decimal('descuento', 12, 2)->nullable();
            $table->string('objeto_imp')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('xml_conceptos');
    }
};
