<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('field_records', function (Blueprint $table) {
            $table->jsonb('niveles_toner')->nullable()->after('valor_contador');
        });
    }

    public function down(): void
    {
        Schema::table('field_records', function (Blueprint $table) {
            $table->dropColumn('niveles_toner');
        });
    }
};
