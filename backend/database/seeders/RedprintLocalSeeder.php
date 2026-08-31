<?php

namespace Database\Seeders;

use App\Enums\ArticleType;
use App\Enums\PrinterStatus;
use App\Models\Article;
use App\Models\Client;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

class RedprintLocalSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::administradores()->first();

        $warehouse = Warehouse::firstOrCreate(
            ['nombre' => 'Local Redprint'],
            [
                'direccion' => 'Local Redprint, calle 5 de febrero #123, Col. Centro',
                'responsable_id' => $admin?->id,
                'activo' => true,
            ]
        );

        Client::firstOrCreate(
            ['razon_social' => 'CBTIS'],
            [
                'rfc' => 'CBT123456AB1',
                'nombre_contacto' => 'Departamento de Sistemas CBTIS',
                'telefono' => '555-4100',
                'correo' => 'sistemas@cbtis.edu.mx',
                'direccion_instalacion' => 'Av. Educacion 100, Col. Escuela, CDMX',
                'creado_por' => $admin->id,
                'fecha_creacion' => now(),
            ]
        );

        $hp = PrinterBrand::firstOrCreate(
            ['slug' => PrinterBrand::slugFrom('HP')],
            ['nombre' => 'HP']
        );

        $canon = PrinterBrand::firstOrCreate(
            ['slug' => PrinterBrand::slugFrom('Canon')],
            ['nombre' => 'Canon']
        );

        $hp521 = PrinterModel::firstOrCreate([
            'brand_id' => $hp->id,
            'nombre' => '521',
        ]);

        $canon1620 = PrinterModel::firstOrCreate([
            'brand_id' => $canon->id,
            'nombre' => '1620',
        ]);

        $printers = [
            ['marca' => 'HP', 'modelo' => '521', 'printer_model_id' => $hp521->id, 'num_serie' => 'SN-HP-521-0001', 'codigo_negocio' => 'IMP-REDPRINT-HP521-0001'],
            ['marca' => 'HP', 'modelo' => '521', 'printer_model_id' => $hp521->id, 'num_serie' => 'SN-HP-521-0002', 'codigo_negocio' => 'IMP-REDPRINT-HP521-0002'],
            ['marca' => 'Canon', 'modelo' => '1620', 'printer_model_id' => $canon1620->id, 'num_serie' => 'SN-CANON-1620-0001', 'codigo_negocio' => 'IMP-REDPRINT-CANON1620-0001'],
            ['marca' => 'Canon', 'modelo' => '1620', 'printer_model_id' => $canon1620->id, 'num_serie' => 'SN-CANON-1620-0002', 'codigo_negocio' => 'IMP-REDPRINT-CANON1620-0002'],
        ];

        foreach ($printers as $printer) {
            Printer::updateOrCreate(
                ['num_serie' => $printer['num_serie']],
                array_merge($printer, [
                    'fecha_adquisicion' => now()->subMonths(6),
                    'costo_adquisicion' => 8500.00,
                    'vida_util_meses' => 60,
                    'estado' => PrinterStatus::EN_ALMACEN,
                    'almacen_id' => $warehouse->id,
                    'contador_actual' => 0,
                    'creado_por' => $admin->id,
                    'fecha_creacion' => now(),
                ])
            );
        }

        $tonerHp = Article::firstOrCreate(
            ['nombre' => 'Toner HP 55X Negro'],
            [
                'tipo_articulo' => ArticleType::CONSUMIBLE,
                'subtipo' => 'TONER',
                'marca' => 'HP',
                'modelo_sku' => '55X',
                'stock_actual' => 10,
                'umbral_reposicion' => 3,
                'costo_unitario' => 1850.00,
                'activo' => true,
                'fecha_creacion' => now(),
            ]
        );
        $tonerHp->modelosCompatibles()->syncWithoutDetaching([$hp521->id]);

        $tonerCanon = Article::firstOrCreate(
            ['nombre' => 'Toner Canon 121 Negro'],
            [
                'tipo_articulo' => ArticleType::CONSUMIBLE,
                'subtipo' => 'TONER',
                'marca' => 'Canon',
                'modelo_sku' => '121',
                'stock_actual' => 10,
                'umbral_reposicion' => 3,
                'costo_unitario' => 1450.00,
                'activo' => true,
                'fecha_creacion' => now(),
            ]
        );
        $tonerCanon->modelosCompatibles()->syncWithoutDetaching([$canon1620->id]);
    }
}
