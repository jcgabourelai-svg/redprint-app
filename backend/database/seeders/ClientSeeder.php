<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\User;
use Illuminate\Database\Seeder;

class ClientSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('rol', 'ADMIN')->first();

        $clients = [
            ['razon_social' => 'Despacho Juridico Torres y Asociados', 'rfc' => 'DJT123456AB1', 'nombre_contacto' => 'Lic. Torres', 'telefono' => '555-4001', 'correo' => 'contacto@torresabogados.com', 'direccion_instalacion' => 'Paseo de la Reforma 250, Col. Juarez, CDMX'],
            ['razon_social' => 'Clinica Medica Santa Maria', 'rfc' => 'CMS789012CD2', 'nombre_contacto' => 'Dr. Hernandez', 'telefono' => '555-4002', 'correo' => 'admin@clinicasantamaria.com', 'direccion_instalacion' => 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX'],
            ['razon_social' => 'Contadores del Valle S.C.', 'rfc' => 'CDV345678EF3', 'nombre_contacto' => 'C.P. Ramirez', 'telefono' => '555-4003', 'correo' => 'info@contadoresdelvalle.com', 'direccion_instalacion' => 'Calle Rio Rhin 45, Col. Cuauhtemoc, CDMX'],
            ['razon_social' => 'Inmobiliaria Casa Perfecta', 'rfc' => 'ICP901234GH4', 'nombre_contacto' => 'Sra. Morales', 'telefono' => '555-4004', 'correo' => 'ventas@casaperfecta.com', 'direccion_instalacion' => 'Av. Polanco 800, Col. Polanco, CDMX'],
            ['razon_social' => 'Escuela Bachilleres Mexico', 'rfc' => 'EBM567890IJ5', 'nombre_contacto' => 'Prof. Gonzalez', 'telefono' => '555-4005', 'correo' => 'direccion@bachilleresmx.edu', 'direccion_instalacion' => 'Calzada de Tlalpan 500, Col. Portales, CDMX'],
            ['razon_social' => 'Restaurante El Buen Sabor S.A.', 'rfc' => 'RBS123456KL6', 'nombre_contacto' => 'Chef Dominguez', 'telefono' => '555-4006', 'correo' => 'admin@elbuensabor.com', 'direccion_instalacion' => 'Calle Amberes 30, Col. Juarez, CDMX'],
            ['razon_social' => 'Constructora Azteca S.A. de C.V.', 'rfc' => 'CAZ789012MN7', 'nombre_contacto' => 'Ing. Vargas', 'telefono' => '555-4007', 'correo' => 'obras@aztecaconstruccion.com', 'direccion_instalacion' => 'Blvd. Manuel Avila Camacho 100, Estado de Mexico'],
            ['razon_social' => 'Transportes Rapidos del Sur', 'rfc' => 'TRS345678OP8', 'nombre_contacto' => 'Sr. Jimenez', 'telefono' => '555-4008', 'correo' => 'operaciones@transportesrapidos.com', 'direccion_instalacion' => 'Av. Universidad 2000, Col. Coyoacan, CDMX'],
            ['razon_social' => 'Farmacia San Angel', 'rfc' => 'FSA901234QR9', 'nombre_contacto' => 'QFB. Ruiz', 'telefono' => '555-4009', 'correo' => 'farmacia@sanangel.com', 'direccion_instalacion' => 'Calle Ciudad Jardin 15, Col. San Angel, CDMX'],
            ['razon_social' => 'Notaria Publica 42', 'rfc' => 'NP42', 'nombre_contacto' => 'Notario Flores', 'telefono' => '555-4010', 'correo' => 'notaria42@notariasmx.com', 'direccion_instalacion' => 'Av. Paseo de la Reforma 500, Col. Cuauhtemoc, CDMX'],
            ['razon_social' => 'Seguros Proteccion Total', 'rfc' => 'SPT567890ST0', 'nombre_contacto' => 'Lic. Navarro', 'telefono' => '555-4011', 'correo' => 'ventas@protecciontotal.com', 'direccion_instalacion' => 'Insurgentes Norte 1500, Col. Santa Maria la Ribera, CDMX'],
            ['razon_social' => 'Tecnologia Digital S.A.', 'rfc' => 'TDI123456UV1', 'nombre_contacto' => 'Ing. Castillo', 'telefono' => '555-4012', 'correo' => 'contacto@tecnologiadigital.com', 'direccion_instalacion' => 'Av. Chapultepec 600, Col. Roma Norte, CDMX'],
        ];

        foreach ($clients as $client) {
            Client::create(array_merge($client, [
                'creado_por' => $admin->id,
                'fecha_creacion' => now(),
            ]));
        }
    }
}
