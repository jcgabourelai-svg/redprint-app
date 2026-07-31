<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('xml_comprobante_id')
                ->nullable()
                ->constrained('xml_comprobantes')
                ->nullOnDelete()
                ->after('comprobante');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['xml_comprobante_id']);
            $table->dropColumn('xml_comprobante_id');
        });
    }
};
