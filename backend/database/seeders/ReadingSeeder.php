<?php

namespace Database\Seeders;

use App\Models\Reading;
use App\Models\Visit;
use App\Models\Contract;
use App\Models\User;
use Illuminate\Database\Seeder;

class ReadingSeeder extends Seeder
{
    public function run(): void
    {
        $users = User::all();
        $completedVisits = Visit::where('estado', 'COMPLETADA')->get();

        foreach ($completedVisits as $visit) {
            $contract = $visit->contract;
            if (!$contract) continue;

            $printers = $contract->activePrinters;

            foreach ($printers as $printer) {
                $pivotData = $contract->printers()
                    ->where('impresora_id', $printer->id)
                    ->wherePivot('activa', true)
                    ->first();

                $initialReading = $pivotData?->pivot?->lectura_inicial ?? 0;
                $currentValue = $initialReading + rand(100, 3000);

                Reading::create([
                    'visita_id' => $visit->id,
                    'impresora_id' => $printer->id,
                    'contrato_id' => $contract->id,
                    'fecha' => $visit->fecha_realizada ?? $visit->fecha_programada,
                    'valor_contador' => $currentValue,
                    'paginas_periodo' => $currentValue - $initialReading,
                    'socio_id' => $users->random()->id,
                    'es_anomalia' => false,
                    'creado_por' => $users->random()->id,
                    'fecha_creacion' => now(),
                ]);
            }
        }
    }
}
