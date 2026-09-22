<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenance_orders', function (Blueprint $table) {
            // Trazabilidad del ciclo: orden preventiva nacida de un plan.
            $table->foreignId('maintenance_plan_id')->nullable()->after('visita_id')
                ->constrained('maintenance_plans')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('maintenance_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('maintenance_plan_id');
        });
    }
};
