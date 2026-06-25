<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $adminId = Role::where('slug', 'administrador')->value('id');
        $operadorId = Role::where('slug', 'operador')->value('id');

        $users = [
            ['nombre' => 'Admin Principal', 'correo' => 'admin@redprint.com', 'telefono' => '555-0101', 'rol_id' => $adminId],
            ['nombre' => 'Admin Secundario', 'correo' => 'admin2@redprint.com', 'telefono' => '555-0102', 'rol_id' => $adminId],
            ['nombre' => 'Admin Tercero', 'correo' => 'admin3@redprint.com', 'telefono' => '555-0103', 'rol_id' => $adminId],
            ['nombre' => 'Operador Uno', 'correo' => 'operador1@redprint.com', 'telefono' => '555-0201', 'rol_id' => $operadorId],
            ['nombre' => 'Operador Dos', 'correo' => 'operador2@redprint.com', 'telefono' => '555-0202', 'rol_id' => $operadorId],
        ];

        foreach ($users as $user) {
            User::firstOrCreate(
                ['correo' => $user['correo']],
                [
                    'nombre' => $user['nombre'],
                    'contrasena_hash' => Hash::make('password'),
                    'telefono' => $user['telefono'],
                    'rol_id' => $user['rol_id'],
                    'activo' => true,
                    'fecha_creacion' => now(),
                ]
            );
        }
    }
}
