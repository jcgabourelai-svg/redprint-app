<?php

namespace Database\Seeders;

use App\Enums\PrinterStatus;
use App\Models\Printer;
use App\Models\Warehouse;
use App\Models\User;
use Illuminate\Database\Seeder;

class PrinterSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('rol', 'ADMIN')->first();
        $warehouses = Warehouse::all();

        $brands = ['HP', 'Canon', 'Epson', 'Brother', 'Samsung'];
        $models = [
            'HP' => ['LaserJet Pro M404dn', 'LaserJet Enterprise M507dn', 'Color LaserJet Pro M283fdw', 'LaserJet Pro MFP M428fdw', 'Neverstop Laser MFP 1202w'],
            'Canon' => ['imageCLASS MF445dw', 'imageCLASS LBP226dw', 'PIXMA TR8620', 'imageRUNNER 2625i'],
            'Epson' => ['WorkForce Pro WF-4830', 'EcoTank L6290', 'WorkForce ES-580W', 'EcoTank L15168'],
            'Brother' => ['MFC-L3770CDW', 'HL-L2395DW', 'MFC-L8900CDW', 'HL-L6450DW'],
            'Samsung' => ['Xpress M2835DW', 'ProXpress M4080FX'],
        ];

        $printers = [];
        $counter = 1;

        foreach ($brands as $brand) {
            foreach ($models[$brand] as $model) {
                $date = now()->subMonths(rand(1, 24));
                $dateStr = $date->format('Ymd');
                $code = 'IMP-' . $dateStr . '-' . str_pad($counter, 4, '0', STR_PAD_LEFT);

                $printers[] = Printer::create([
                    'marca' => $brand,
                    'modelo' => $model,
                    'num_serie' => 'SN-' . strtoupper(substr($brand, 0, 3)) . '-' . str_pad($counter, 6, '0', STR_PAD_LEFT),
                    'fecha_adquisicion' => $date,
                    'costo_adquisicion' => rand(3000, 25000) + (rand(0, 99) / 100),
                    'codigo_negocio' => $code,
                    'vida_util_meses' => rand(36, 72),
                    'estado' => PrinterStatus::EN_ALMACEN,
                    'almacen_id' => $warehouses->random()->id,
                    'contador_actual' => rand(0, 50000),
                    'creado_por' => $admin->id,
                    'fecha_creacion' => now(),
                ]);

                $counter++;
            }
        }
    }
}
