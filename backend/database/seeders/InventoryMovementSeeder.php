<?php

namespace Database\Seeders;

use App\Enums\MovementType;
use App\Models\Article;
use App\Models\InventoryMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class InventoryMovementSeeder extends Seeder
{
    public function run(): void
    {
        $articles = Article::all();
        $admin = User::where('rol', 'ADMIN')->first();

        foreach ($articles as $article) {
            $initialQty = rand(5, 25);
            InventoryMovement::create([
                'articulo_id' => $article->id,
                'tipo_movimiento' => MovementType::ENTRADA,
                'cantidad' => $initialQty,
                'stock_anterior' => 0,
                'stock_posterior' => $initialQty,
                'referencia_tipo' => 'INVENTARIO_INICIAL',
                'referencia_id' => null,
                'justificacion' => 'Inventario inicial',
                'fecha' => now()->subMonths(rand(3, 12)),
                'socio_id' => $admin->id,
                'fecha_creacion' => now(),
            ]);

            for ($i = 0; $i < rand(1, 3); $i++) {
                $exitQty = rand(1, min(5, $article->stock_actual));
                if ($exitQty <= 0) continue;

                InventoryMovement::create([
                    'articulo_id' => $article->id,
                    'tipo_movimiento' => MovementType::SALIDA,
                    'cantidad' => $exitQty,
                    'stock_anterior' => $article->stock_actual,
                    'stock_posterior' => $article->stock_actual - $exitQty,
                    'referencia_tipo' => 'MANTENIMIENTO',
                    'referencia_id' => null,
                    'justificacion' => 'Salida por mantenimiento',
                    'fecha' => now()->subDays(rand(1, 90)),
                    'socio_id' => $admin->id,
                    'fecha_creacion' => now(),
                ]);
            }
        }
    }
}
