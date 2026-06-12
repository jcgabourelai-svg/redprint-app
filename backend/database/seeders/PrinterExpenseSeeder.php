<?php

namespace Database\Seeders;

use App\Models\Printer;
use App\Models\PrinterExpense;
use App\Models\User;
use Illuminate\Database\Seeder;

class PrinterExpenseSeeder extends Seeder
{
    public function run(): void
    {
        $printers = Printer::all();
        $users = User::where('activo', true)->get();

        for ($i = 0; $i < 20; $i++) {
            PrinterExpense::create([
                'impresora_id' => $printers->random()->id,
                'tipo' => rand(0, 1) === 0 ? 'TRANSPORTE' : 'OTRO',
                'monto' => rand(100, 2000) + (rand(0, 99) / 100),
                'fecha' => now()->subDays(rand(1, 180)),
                'descripcion' => rand(0, 1) === 0 ? 'Transporte de impresora' : 'Gastos miscelaneos',
                'socio_id' => $users->random()->id,
                'fecha_creacion' => now(),
            ]);
        }
    }
}
