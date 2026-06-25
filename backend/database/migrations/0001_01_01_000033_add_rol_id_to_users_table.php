<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('rol_id')->nullable()->after('telefono');
            $table->foreign('rol_id')->references('id')->on('roles')->nullOnDelete();
        });

        // Mapear usuarios existentes segun la columna legacy `rol`.
        $administradorId = DB::table('roles')->where('slug', 'administrador')->value('id');
        $operadorId = DB::table('roles')->where('slug', 'operador')->value('id');

        if ($administradorId) {
            DB::table('users')
                ->where('rol', 'ADMIN')
                ->update(['rol_id' => $administradorId]);
        }

        if ($operadorId) {
            // OPERADOR, cualquier otro valor o null -> Operador (preserva conducta actual).
            DB::table('users')
                ->whereNull('rol_id')
                ->update(['rol_id' => $operadorId]);
        }

        // End state limpio: eliminar la columna legacy.
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('rol');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('rol')->default('OPERADOR')->after('telefono');
        });

        // Restaurar el valor legacy a partir del rol asignado.
        $administradorId = DB::table('roles')->where('slug', 'administrador')->value('id');

        if ($administradorId) {
            DB::table('users')
                ->where('rol_id', $administradorId)
                ->update(['rol' => 'ADMIN']);
        }

        DB::table('users')
            ->whereNull('rol')
            ->update(['rol' => 'OPERADOR']);

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['rol_id']);
            $table->dropColumn('rol_id');
        });
    }
};
