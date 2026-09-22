<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('articles_used', function (Blueprint $table) {
            $table->string('origen_snapshot')->nullable()->after('subtotal');
        });
    }

    public function down(): void
    {
        Schema::table('articles_used', function (Blueprint $table) {
            $table->dropColumn(['origen_snapshot']);
        });
    }
};
