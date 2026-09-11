<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Siembra el permiso `sistema.actualizar` de forma idempotente
     * (patron de la migracion 2026_08_26_000003::seedPermission()).
     * Invariante: SOLO el rol `administrador` lo conserva. La 000032
     * sincroniza todo el catalogo a `operador` en instalaciones frescas,
     * asi que desacoplamos aqui para que ambas rutas (migrate desde cero y
     * upgrade del VPS) converjan: operador no dispara updates de produccion.
     * Los roles es_sistema tienen bypass en EnsurePermission, pero el attach
     * mantiene el catalogo consistente para la UI de roles.
     */
    public function up(): void
    {
        $permiso = Permission::firstOrCreate(
            ['clave' => 'sistema.actualizar'],
            [
                'modulo' => 'sistema',
                'etiqueta' => 'Actualizar sistema',
            ]
        );

        $otros = $permiso->roles()->where('roles.slug', '!=', 'administrador')->pluck('roles.id');
        if ($otros->isNotEmpty()) {
            $permiso->roles()->detach($otros);
        }

        $rol = Role::firstWhere('slug', 'administrador');
        if ($rol && ! $rol->permissions()->where('permission_id', $permiso->id)->exists()) {
            $rol->permissions()->attach($permiso->id);
        }
    }

    public function down(): void
    {
        $permiso = Permission::where('clave', 'sistema.actualizar')->first();

        if ($permiso) {
            $permiso->roles()->detach();
            $permiso->delete();
        }
    }
};
