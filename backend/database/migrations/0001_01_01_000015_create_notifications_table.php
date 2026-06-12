<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->string('tipo');
            $table->string('titulo');
            $table->text('mensaje');
            $table->boolean('leida')->default(false);
            $table->string('referencia_tipo')->nullable();
            $table->unsignedBigInteger('referencia_id')->nullable();
            $table->timestamp('fecha')->nullable();
            $table->timestamps();

            $table->index(['usuario_id', 'leida']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
