<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('printers', function (Blueprint $table) {
            $table->string('condicion')->nullable()->after('estado');
            $table->text('condicion_nota')->nullable()->after('condicion');
            $table->timestamp('condicion_actualizada_en')->nullable()->after('condicion_nota');

            $table->index('condicion');
        });
    }

    public function down(): void
    {
        Schema::table('printers', function (Blueprint $table) {
            $table->dropIndex(['condicion']);
            $table->dropColumn(['condicion', 'condicion_nota', 'condicion_actualizada_en']);
        });
    }
};
