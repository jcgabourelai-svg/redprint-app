<?php

namespace Database\Seeders;

use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use App\Enums\ProblemSeverity;
use App\Enums\ProblemType;
use App\Models\Article;
use App\Models\ArticleUsed;
use App\Models\MaintenanceOrder;
use App\Models\Printer;
use App\Models\User;
use Illuminate\Database\Seeder;

class MaintenanceOrderSeeder extends Seeder
{
    public function run(): void
    {
        $printers = Printer::all();
        $users = User::where('activo', true)->get();
        $articles = Article::all();

        $descriptions = [
            'PREVENTIVO' => [
                'Limpieza general y revision de componentes',
                'Cambio de rodillo de transferencia',
                'Limpieza de fusora y revision',
                'Revision y calibracion de bandejas',
                'Limpieza de sensor laser',
            ],
            'CORRECTIVO' => [
                'Reemplazo de fusora defectuosa',
                'Reparacion de atasco recurrente',
                'Cambio de tarjeta principal',
                'Reparacion de alimentador automatico',
                'Reemplazo de rodillo de pickup desgastado',
            ],
        ];

        $problemTypesByDescription = [
            'Reemplazo de fusora defectuosa' => [
                ProblemType::NO_IMPRIME,
                ProblemType::CALIDAD_DEFICIENTE,
            ],
            'Reparacion de atasco recurrente' => [
                ProblemType::ATASCOS,
            ],
            'Cambio de tarjeta principal' => [
                ProblemType::NO_IMPRIME,
                ProblemType::ERROR_PANTALLA,
            ],
            'Reparacion de alimentador automatico' => [
                ProblemType::ATASCOS,
            ],
            'Reemplazo de rodillo de pickup desgastado' => [
                ProblemType::ATASCOS,
                ProblemType::CALIDAD_DEFICIENTE,
            ],
        ];

        for ($i = 0; $i < 30; $i++) {
            $type = $i < 20 ? MaintenanceType::PREVENTIVO : MaintenanceType::CORRECTIVO;
            $isCompleted = rand(0, 100) < 70;
            $estado = $isCompleted ? MaintenanceStatus::COMPLETADA : MaintenanceStatus::PROGRAMADA;

            $printer = $printers->random();
            $socio = $users->random();
            $fecha = now()->subDays(rand(1, 180));

            $descProblema = $descriptions[$type->value][array_rand($descriptions[$type->value])];
            $costoManoObra = rand(200, 3000) + (rand(0, 99) / 100);

            $order = MaintenanceOrder::create([
                'impresora_id' => $printer->id,
                'fecha' => $fecha,
                'tipo_mantto' => $type,
                'desc_problema' => $descProblema,
                'tipo_problema' => $type === MaintenanceType::CORRECTIVO
                    ? $problemTypesByDescription[$descProblema][array_rand($problemTypesByDescription[$descProblema])]
                    : null,
                'severidad' => $type === MaintenanceType::CORRECTIVO
                    ? ProblemSeverity::cases()[array_rand(ProblemSeverity::cases())]
                    : null,
                'trabajo_realizado' => $isCompleted ? $descProblema . ' - Completado' : null,
                'costo_mano_obra' => $costoManoObra,
                'costo_total' => $costoManoObra,
                'socio_id' => $socio->id,
                'estado' => $estado,
                'fecha_creacion' => now(),
            ]);

            $numArticles = rand(0, 3);
            $articlesCost = 0;
            for ($j = 0; $j < $numArticles; $j++) {
                $article = $articles->random();
                $cantidad = rand(1, 2);
                $subtotal = $cantidad * (float) $article->costo_unitario;
                $articlesCost += $subtotal;

                ArticleUsed::create([
                    'articulo_id' => $article->id,
                    'orden_mantto_id' => $order->id,
                    'cantidad' => $cantidad,
                    'costo_unitario' => $article->costo_unitario,
                    'subtotal' => $subtotal,
                ]);
            }

            if ($isCompleted) {
                $order->update([
                    'costo_total' => (float) $order->costo_mano_obra + $articlesCost,
                ]);
            }
        }
    }
}
