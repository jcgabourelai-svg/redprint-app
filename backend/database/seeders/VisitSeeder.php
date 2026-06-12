<?php

namespace Database\Seeders;

use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Contract;
use App\Models\Visit;
use App\Models\User;
use Illuminate\Database\Seeder;

class VisitSeeder extends Seeder
{
    public function run(): void
    {
        $users = User::all();
        $contracts = Contract::all();
        $types = [VisitType::LECTURA, VisitType::INSTALACION, VisitType::MANTENIMIENTO];
        $statuses = [VisitStatus::PENDIENTE, VisitStatus::COMPLETADA, VisitStatus::REPROGRAMADA];

        foreach ($contracts as $contract) {
            $numVisits = rand(2, 5);
            for ($i = 0; $i < $numVisits; $i++) {
                $date = now()->subDays(rand(1, 60))->addDays(rand(0, 30));
                $status = $statuses[array_rand($statuses)];

                Visit::create([
                    'cliente_id' => $contract->cliente_id,
                    'contrato_id' => $contract->id,
                    'tipo_visita' => $types[array_rand($types)],
                    'fecha_programada' => $date,
                    'fecha_realizada' => $status === VisitStatus::COMPLETADA ? $date : null,
                    'socio_id' => $users->random()->id,
                    'estado' => $status,
                    'notas' => rand(0, 1) ? 'Visita de rutina' : null,
                    'creado_por' => $users->random()->id,
                    'fecha_creacion' => now(),
                ]);
            }
        }
    }
}
