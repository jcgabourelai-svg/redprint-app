<?php

namespace Database\Seeders;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Printer;
use App\Models\User;
use App\Support\PrinterColorPalette;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ContractSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::administradores()->first();
        $clients = Client::all();
        $printers = Printer::all();

        $frequencies = ['MENSUAL', 'QUINCENAL', 'SEMANAL'];

        $contracts = [];
        $seq = 1;
        $aliasPool = ['Recepción', 'Contabilidad', 'Taller', 'Gerencia', 'Almacén'];

        for ($i = 0; $i < 10; $i++) {
            $client = $clients[$i % $clients->count()];
            $freq = $frequencies[array_rand($frequencies)];

            $contract = Contract::create([
                'cliente_id' => $client->id,
                'codigo_negocio' => 'CTR-' . str_pad($seq, 4, '0', STR_PAD_LEFT),
                'fecha_inicio' => now()->subMonths(rand(1, 12)),
                'fecha_fin' => rand(0, 1) ? now()->addMonths(rand(1, 12)) : null,
                'tarifa_base' => rand(1500, 5000),
                'paginas_incluidas' => rand(1000, 5000),
                'costo_pag_excedente' => rand(10, 50) / 100,
                'dias_gracia' => rand(3, 15),
                'frecuencia_visitas' => $freq,
                'dias_adelanto' => 7,
                'estado' => ContractStatus::ACTIVO,
                'creado_por' => $admin->id,
                'fecha_creacion' => now(),
            ]);

            $numPrinters = rand(1, 3);
            $availablePrinters = Printer::where('estado', PrinterStatus::EN_ALMACEN)
                ->inRandomOrder()
                ->take($numPrinters)
                ->get();

            $aliasIndex = 0;
            foreach ($availablePrinters as $printer) {
                DB::table('contract_printer')->insert([
                    'contrato_id' => $contract->id,
                    'impresora_id' => $printer->id,
                    'fecha_asignacion' => $contract->fecha_inicio,
                    'lectura_inicial' => rand(0, 10000),
                    'alias' => $aliasPool[$aliasIndex % count($aliasPool)],
                    'color' => PrinterColorPalette::KEYS[$aliasIndex % count(PrinterColorPalette::KEYS)],
                    'activa' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $aliasIndex++;

                $printer->update([
                    'estado' => PrinterStatus::RENTADA,
                    'almacen_id' => null,
                ]);
            }

            $contracts[] = $contract;
            $seq++;
        }

        // D-J: contrato demo con plan de modelos SIN series asignadas, para
        // evidenciar el flujo de instalación inicial desde la app de campo
        // (el operador vincula la serie real y captura la línea base).
        if ($clients->isNotEmpty()) {
            $printerEnStock = Printer::where('estado', PrinterStatus::EN_ALMACEN)
                ->whereNotNull('printer_model_id')
                ->inRandomOrder()
                ->first();

            if ($printerEnStock?->printer_model_id) {
                $demo = Contract::create([
                    'cliente_id' => $clients->last()->id,
                    'codigo_negocio' => 'CTR-' . str_pad($seq, 4, '0', STR_PAD_LEFT),
                    'fecha_inicio' => now()->subDays(3),
                    'tarifa_base' => 1800,
                    'paginas_incluidas' => 1000,
                    'costo_pag_excedente' => 0.02,
                    'dias_gracia' => 10,
                    'frecuencia_visitas' => 'MENSUAL',
                    'dias_adelanto' => 7,
                    'estado' => ContractStatus::ACTIVO,
                    'creado_por' => $admin->id,
                    'fecha_creacion' => now(),
                ]);

                $demo->planImpresoras()->create([
                    'printer_model_id' => $printerEnStock->printer_model_id,
                    'cantidad' => 2,
                ]);
            }
        }
    }
}
