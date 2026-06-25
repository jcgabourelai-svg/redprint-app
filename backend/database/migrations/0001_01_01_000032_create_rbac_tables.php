<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('slug')->unique();
            $table->text('descripcion')->nullable();
            $table->boolean('es_sistema')->default(false);
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('clave')->unique();
            $table->string('modulo');
            $table->string('etiqueta');
            $table->text('descripcion')->nullable();
            $table->timestamps();
        });

        Schema::create('permission_role', function (Blueprint $table) {
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained('permissions')->cascadeOnDelete();
            $table->primary(['role_id', 'permission_id']);
            $table->timestamps();
        });

        $this->seed();
    }

    /**
     * Siembra el catalogo de permisos y los roles base de forma idempotente.
     * Se hace en la migracion (no en un seeder) para garantizar que existan
     * antes del mapeo de usuarios existentes en la migracion 000033.
     */
    private function seed(): void
    {
        $catalogo = config('permisos');

        foreach ($catalogo as $modulo => $permisos) {
            foreach ($permisos as $permiso) {
                \App\Models\Permission::firstOrCreate(
                    ['clave' => $permiso['clave']],
                    [
                        'modulo' => $modulo,
                        'etiqueta' => $permiso['etiqueta'],
                    ]
                );
            }
        }

        $todosLosIds = \App\Models\Permission::pluck('id')->all();

        $administrador = \App\Models\Role::firstOrCreate(
            ['slug' => 'administrador'],
            [
                'nombre' => 'Administrador',
                'descripcion' => 'Rol sistema con bypass total de permisos',
                'es_sistema' => true,
            ]
        );
        $administrador->permissions()->sync($todosLosIds);

        $operador = \App\Models\Role::firstOrCreate(
            ['slug' => 'operador'],
            [
                'nombre' => 'Operador',
                'descripcion' => 'Operador con acceso a todos los modulos',
                'es_sistema' => false,
            ]
        );
        $operador->permissions()->sync($todosLosIds);
    }

    public function down(): void
    {
        Schema::dropIfExists('permission_role');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
