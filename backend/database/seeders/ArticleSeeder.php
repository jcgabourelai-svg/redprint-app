<?php

namespace Database\Seeders;

use App\Enums\ArticleType;
use App\Models\Article;
use App\Models\Supplier;
use App\Models\Printer;
use Illuminate\Database\Seeder;

class ArticleSeeder extends Seeder
{
    public function run(): void
    {
        $suppliers = Supplier::all();
        $printers = Printer::all();
        $printerIds = $printers->pluck('id')->take(10)->values()->toArray();

        $articles = [
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner HP 26A Negro', 'marca' => 'HP', 'modelo_sku' => 'CF226A', 'costo_unitario' => 1850.00, 'umbral_reposicion' => 3],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner HP 79A Negro', 'marca' => 'HP', 'modelo_sku' => 'CF279A', 'costo_unitario' => 1450.00, 'umbral_reposicion' => 3],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner Canon 054 Negro', 'marca' => 'Canon', 'modelo_sku' => '3025C001', 'costo_unitario' => 1650.00, 'umbral_reposicion' => 2],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner Epson 212 Negro', 'marca' => 'Epson', 'modelo_sku' => '212-BK', 'costo_unitario' => 780.00, 'umbral_reposicion' => 5],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner Brother TN-2420', 'marca' => 'Brother', 'modelo_sku' => 'TN-2420', 'costo_unitario' => 1350.00, 'umbral_reposicion' => 3],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner Samsung MLT-D111S', 'marca' => 'Samsung', 'modelo_sku' => 'MLT-D111S', 'costo_unitario' => 1100.00, 'umbral_reposicion' => 2],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'PAPEL', 'nombre' => 'Papel A4 Resma 500 hojas', 'marca' => 'Scribe', 'modelo_sku' => 'A4-500', 'costo_unitario' => 89.00, 'umbral_reposicion' => 10],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'PAPEL', 'nombre' => 'Papel Carta Resma 500 hojas', 'marca' => 'Scribe', 'modelo_sku' => 'LTR-500', 'costo_unitario' => 85.00, 'umbral_reposicion' => 10],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'ETIQUETAS', 'nombre' => 'Etiquetas adhesivas A4', 'marca' => 'Avery', 'modelo_sku' => 'LBL-A4', 'costo_unitario' => 150.00, 'umbral_reposicion' => 5],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner HP 410X Ciano', 'marca' => 'HP', 'modelo_sku' => 'CF411X', 'costo_unitario' => 2800.00, 'umbral_reposicion' => 2],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner HP 410X Magenta', 'marca' => 'HP', 'modelo_sku' => 'CF413X', 'costo_unitario' => 2800.00, 'umbral_reposicion' => 2],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner HP 410X Amarillo', 'marca' => 'HP', 'modelo_sku' => 'CF412X', 'costo_unitario' => 2800.00, 'umbral_reposicion' => 2],
            ['tipo_articulo' => 'REPARACION', 'subtipo' => 'RODILLO', 'nombre' => 'Rodillo de transferencia HP M404', 'marca' => 'HP', 'modelo_sku' => 'RM2-5399', 'costo_unitario' => 650.00, 'umbral_reposicion' => 2],
            ['tipo_articulo' => 'REPARACION', 'subtipo' => 'FUSORA', 'nombre' => 'Kit fusora HP M404', 'marca' => 'HP', 'modelo_sku' => 'RM2-5401', 'costo_unitario' => 3200.00, 'umbral_reposicion' => 1],
            ['tipo_articulo' => 'REPARACION', 'subtipo' => 'RODILLO', 'nombre' => 'Rodillo de alimentacion Canon', 'marca' => 'Canon', 'modelo_sku' => 'FK2-8011', 'costo_unitario' => 480.00, 'umbral_reposicion' => 2],
            ['tipo_articulo' => 'REPARACION', 'subtipo' => 'TARJETA', 'nombre' => 'Tarjeta de formato Canon', 'marca' => 'Canon', 'modelo_sku' => 'FK2-8050', 'costo_unitario' => 1800.00, 'umbral_reposicion' => 1],
            ['tipo_articulo' => 'REPARACION', 'subtipo' => 'FUSORA', 'nombre' => 'Fusora Epson WF-4830', 'marca' => 'Epson', 'modelo_sku' => 'FUSE-WF4830', 'costo_unitario' => 2900.00, 'umbral_reposicion' => 1],
            ['tipo_articulo' => 'REPARACION', 'subtipo' => 'RODILLO', 'nombre' => 'Rodillo pickup Brother', 'marca' => 'Brother', 'modelo_sku' => 'PU-BR3770', 'costo_unitario' => 420.00, 'umbral_reposicion' => 2],
            ['tipo_articulo' => 'REPARACION', 'subtipo' => 'TARJETA', 'nombre' => 'Tarjeta principal Brother MFC', 'marca' => 'Brother', 'modelo_sku' => 'MAIN-MFC8900', 'costo_unitario' => 4500.00, 'umbral_reposicion' => 1],
            ['tipo_articulo' => 'REPARACION', 'subtipo' => 'FUSORA', 'nombre' => 'Fusora Samsung Xpress', 'marca' => 'Samsung', 'modelo_sku' => 'FUSE-SAM2835', 'costo_unitario' => 2100.00, 'umbral_reposicion' => 1],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner Canon 054H Ciano', 'marca' => 'Canon', 'modelo_sku' => '3026C001', 'costo_unitario' => 2400.00, 'umbral_reposicion' => 2],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner Epson 212XL Negro', 'marca' => 'Epson', 'modelo_sku' => '212XL-BK', 'costo_unitario' => 1200.00, 'umbral_reposicion' => 3],
            ['tipo_articulo' => 'REPARACION', 'subtipo' => 'RODILLO', 'nombre' => 'Rodillo de impresion generico', 'marca' => 'Generico', 'modelo_sku' => 'ROLL-GEN', 'costo_unitario' => 350.00, 'umbral_reposicion' => 3],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'TONER', 'nombre' => 'Toner Brother TN-7600', 'marca' => 'Brother', 'modelo_sku' => 'TN-7600', 'costo_unitario' => 1700.00, 'umbral_reposicion' => 2],
            ['tipo_articulo' => 'CONSUMIBLE', 'subtipo' => 'OTRO', 'nombre' => 'Kit limpieza generico', 'marca' => 'Generico', 'modelo_sku' => 'CLN-GEN', 'costo_unitario' => 250.00, 'umbral_reposicion' => 5],
        ];

        foreach ($articles as $article) {
            Article::create([
                'tipo_articulo' => $article['tipo_articulo'],
                'subtipo' => $article['subtipo'],
                'nombre' => $article['nombre'],
                'marca' => $article['marca'],
                'modelo_sku' => $article['modelo_sku'],
                'stock_actual' => rand(0, 20),
                'umbral_reposicion' => $article['umbral_reposicion'],
                'costo_unitario' => $article['costo_unitario'],
                'proveedor_id' => $suppliers->random()->id,
                'impresoras_compatibles' => collect($printerIds)->random(min(5, count($printerIds)))->values()->toArray(),
                'activo' => true,
                'fecha_creacion' => now(),
            ]);
        }
    }
}
