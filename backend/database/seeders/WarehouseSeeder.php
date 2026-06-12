<?php

namespace Database\Seeders;

use App\Models\Warehouse;
use App\Models\User;
use Illuminate\Database\Seeder;

class WarehouseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('rol', 'ADMIN')->first();

        $warehouses = [
            ['nombre' => 'Almacen Central', 'direccion' => 'Av. Principal 100, Col. Centro, CDMX', 'responsable_id' => $admin?->id],
            ['nombre' => 'Almacen Norte', 'direccion' => 'Blvd. Norte 250, Col. Industrial, Estado de Mexico', 'responsable_id' => $admin?->id],
            ['nombre' => 'Almacen Sur', 'direccion' => 'Calle Sur 80, Col. Del Valle, CDMX', 'responsable_id' => $admin?->id],
        ];

        foreach ($warehouses as $warehouse) {
            Warehouse::create($warehouse);
        }
    }
}
