<?php

namespace Database\Seeders;

use App\Models\Supplier;
use Illuminate\Database\Seeder;

class SupplierSeeder extends Seeder
{
    public function run(): void
    {
        $suppliers = [
            ['razon_social' => 'HP Mexico S.A. de C.V.', 'rfc' => 'HME123456AB1', 'contacto' => 'Carlos Lopez', 'telefono' => '555-3001', 'correo' => 'ventas@hpmexico.com'],
            ['razon_social' => 'Canon Distribuidora', 'rfc' => 'CDI789012CD2', 'contacto' => 'Maria Garcia', 'telefono' => '555-3002', 'correo' => 'pedidos@canondist.com'],
            ['razon_social' => 'Epson Latinoamerica', 'rfc' => 'ELA345678EF3', 'contacto' => 'Roberto Diaz', 'telefono' => '555-3003', 'correo' => 'contacto@epsonlat.com'],
            ['razon_social' => 'Brother Mexico', 'rfc' => 'BMX901234GH4', 'contacto' => 'Ana Martinez', 'telefono' => '555-3004', 'correo' => 'info@brothermx.com'],
            ['razon_social' => 'Toner Express S.A.', 'rfc' => 'TEX567890IJ5', 'contacto' => 'Luis Fernandez', 'telefono' => '555-3005', 'correo' => 'ventas@tonerexpress.com'],
        ];

        foreach ($suppliers as $supplier) {
            Supplier::create($supplier);
        }
    }
}
