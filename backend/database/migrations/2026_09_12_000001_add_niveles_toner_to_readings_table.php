<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('readings', function (Blueprint $table) {
            $table->jsonb('niveles_toner')->nullable()->after('paginas_periodo');
        });
    }

    public function down(): void
    {
        Schema::table('readings', function (Blueprint $table) {
            $table->dropColumn('niveles_toner');
        });
    }
};
