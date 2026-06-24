<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->string('motivo_baja')->nullable()->after('activo');
            $table->timestamp('fecha_baja')->nullable()->after('motivo_baja');
        });
    }

    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn(['motivo_baja', 'fecha_baja']);
        });
    }
};
