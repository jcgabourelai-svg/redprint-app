<?php

namespace Database\Seeders;

use App\Enums\PurchaseStatus;
use App\Models\Article;
use App\Models\Purchase;
use App\Models\PurchaseDetail;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;

class PurchaseSeeder extends Seeder
{
    public function run(): void
    {
        $suppliers = Supplier::all();
        $users = User::where('rol', 'ADMIN')->get();
        $articles = Article::all();

        for ($i = 0; $i < 15; $i++) {
            $estado = $i < 10 ? PurchaseStatus::RECIBIDA : PurchaseStatus::PENDIENTE;
            $supplier = $suppliers->random();
            $fecha = now()->subDays(rand(1, 120));

            $purchase = Purchase::create([
                'proveedor_id' => $supplier->id,
                'fecha' => $fecha,
                'fecha_vto_pago' => $fecha->copy()->addDays(30),
                'concepto' => 'Compra de articulos - ' . $supplier->razon_social,
                'monto_total' => 0,
                'monto_pagado' => 0,
                'saldo_pendiente' => 0,
                'estado' => $estado,
                'socio_id' => $users->random()->id,
                'fecha_creacion' => now(),
            ]);

            $montoTotal = 0;
            $numDetails = rand(1, 5);
            for ($j = 0; $j < $numDetails; $j++) {
                $article = $articles->random();
                $cantidad = rand(2, 10);
                $costoUnitario = $article->costo_unitario;
                $subtotal = $cantidad * (float) $costoUnitario;
                $montoTotal += $subtotal;

                PurchaseDetail::create([
                    'compra_id' => $purchase->id,
                    'articulo_id' => $article->id,
                    'articulo_nombre' => $article->nombre,
                    'cantidad' => $cantidad,
                    'costo_unitario' => $costoUnitario,
                    'subtotal' => $subtotal,
                ]);
            }

            $montoPagado = $estado === PurchaseStatus::RECIBIDA
                ? $montoTotal * (rand(0, 100) / 100)
                : 0;

            $purchase->update([
                'monto_total' => $montoTotal,
                'monto_pagado' => $montoPagado,
                'saldo_pendiente' => $montoTotal - $montoPagado,
            ]);
        }
    }
}
