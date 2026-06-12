<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            ['nombre' => 'Admin Principal', 'correo' => 'admin@redprint.com', 'telefono' => '555-0101', 'rol' => UserRole::ADMIN],
            ['nombre' => 'Admin Secundario', 'correo' => 'admin2@redprint.com', 'telefono' => '555-0102', 'rol' => UserRole::ADMIN],
            ['nombre' => 'Admin Tercero', 'correo' => 'admin3@redprint.com', 'telefono' => '555-0103', 'rol' => UserRole::ADMIN],
            ['nombre' => 'Operador Uno', 'correo' => 'operador1@redprint.com', 'telefono' => '555-0201', 'rol' => UserRole::OPERADOR],
            ['nombre' => 'Operador Dos', 'correo' => 'operador2@redprint.com', 'telefono' => '555-0202', 'rol' => UserRole::OPERADOR],
        ];

        foreach ($users as $user) {
            User::create([
                'nombre' => $user['nombre'],
                'correo' => $user['correo'],
                'contrasena_hash' => Hash::make('password'),
                'telefono' => $user['telefono'],
                'rol' => $user['rol'],
                'activo' => true,
                'fecha_creacion' => now(),
            ]);
        }
    }
}
