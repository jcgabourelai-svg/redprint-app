<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('period_validations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('period_close_id')->constrained('period_closes');
            $table->string('nombre');
            $table->enum('estado', ['ok', 'warning', 'error'])->default('ok');
            $table->text('mensaje')->nullable();
            $table->string('link')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('period_validations');
    }
};
