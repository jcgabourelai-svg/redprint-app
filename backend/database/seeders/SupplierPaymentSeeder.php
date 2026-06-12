<?php

namespace Database\Seeders;

use App\Models\Purchase;
use App\Models\SupplierPayment;
use App\Models\User;
use Illuminate\Database\Seeder;

class SupplierPaymentSeeder extends Seeder
{
    public function run(): void
    {
        $purchases = Purchase::with('payments')->get();
        $users = User::where('rol', 'ADMIN')->get();
        $metodos = ['TRANSFERENCIA', 'EFECTIVO', 'CHEQUE'];

        foreach ($purchases as $purchase) {
            $paymentsCount = rand(0, 2);
            for ($i = 0; $i < $paymentsCount; $i++) {
                $remaining = (float) $purchase->saldo_pendiente;
                if ($remaining <= 0) break;

                $monto = min($remaining, rand(500, (int) $remaining));

                SupplierPayment::create([
                    'compra_id' => $purchase->id,
                    'fecha' => $purchase->fecha->copy()->addDays(rand(5, 45)),
                    'monto' => $monto,
                    'metodo' => $metodos[array_rand($metodos)],
                    'socio_id' => $users->random()->id,
                    'fecha_creacion' => now(),
                ]);
            }
        }
    }
}
