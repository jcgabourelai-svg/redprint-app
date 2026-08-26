<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenance_orders', function (Blueprint $table) {
            $table->string('tipo_problema')->nullable()->after('desc_problema');
            $table->string('severidad')->nullable()->after('tipo_problema');

            $table->index('tipo_problema');
            $table->index('severidad');
        });
    }

    public function down(): void
    {
        Schema::table('maintenance_orders', function (Blueprint $table) {
            $table->dropIndex(['tipo_problema']);
            $table->dropIndex(['severidad']);
            $table->dropColumn(['tipo_problema', 'severidad']);
        });
    }
};
