<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $operador = Role::firstOrCreate(
            ['slug' => 'operador'],
            [
                'nombre' => 'Operador',
                'descripcion' => 'Operador con acceso a todos los modulos',
                'es_sistema' => false,
            ]
        );
        $operador->permissions()->sync(Permission::pluck('id')->all());

        // Rol limitado para el MVP1: solo inventario basico.
        $operadorInventario = Role::firstOrCreate(
            ['slug' => 'operador-inventario'],
            [
                'nombre' => 'Operador Inventario',
                'descripcion' => 'Solo acceso a Impresoras, Articulos y Almacenes',
                'es_sistema' => false,
            ]
        );
        $operadorInventario->permissions()->sync(
            Permission::whereIn('clave', [
                'inventario.impresoras',
                'inventario.almacenes',
                'inventario.articulos',
            ])->pluck('id')->all()
        );

        User::firstOrCreate(
            ['correo' => 'mvp1@redprint.com'],
            [
                'nombre' => 'Usuario MVP1',
                'contrasena_hash' => Hash::make('password'),
                'telefono' => '555-0301',
                'rol_id' => $operadorInventario->id,
                'activo' => true,
                'fecha_creacion' => now(),
            ]
        );
    }
}
