<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('accion');
            $table->string('entidad_tipo');
            $table->unsignedBigInteger('entidad_id');
            $table->string('ip_origen', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('fecha')->nullable();
            $table->timestamps();

            $table->index(['entidad_tipo', 'entidad_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
