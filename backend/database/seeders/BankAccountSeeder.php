<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use App\Models\BankMovement;
use App\Models\User;
use Illuminate\Database\Seeder;

class BankAccountSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('rol', 'ADMIN')->first();

        $accounts = [
            ['banco' => 'BBVA', 'tipo_cuenta' => 'CHEQUES', 'numero_cuenta' => '1234567890123456', 'moneda' => 'MXN', 'saldo_inicial' => 100000.00, 'descripcion' => 'Cuenta operativa principal'],
            ['banco' => 'BANAMEX', 'tipo_cuenta' => 'AHORRO', 'numero_cuenta' => '2345678901234567', 'moneda' => 'MXN', 'saldo_inicial' => 50000.00, 'descripcion' => 'Cuenta de ahorro'],
            ['banco' => 'SANTANDER', 'tipo_cuenta' => 'CHEQUES', 'numero_cuenta' => '3456789012345678', 'moneda' => 'MXN', 'saldo_inicial' => 75000.00, 'descripcion' => 'Cuenta de pagos a proveedores'],
        ];

        foreach ($accounts as $account) {
            BankAccount::create([
                'banco' => $account['banco'],
                'tipo_cuenta' => $account['tipo_cuenta'],
                'numero_cuenta' => $account['numero_cuenta'],
                'moneda' => $account['moneda'],
                'saldo' => $account['saldo_inicial'],
                'saldo_inicial' => $account['saldo_inicial'],
                'descripcion' => $account['descripcion'],
                'activo' => true,
                'socio_id' => $admin->id,
            ]);
        }

        $createdAccounts = BankAccount::all();

        $tipos = ['DEPOSITO', 'RETIRO'];
        $ingresosDesc = ['pago cliente', 'factura cobrada', 'servicio'];
        $egresosDesc = ['pago proveedor', 'compra articulos', 'gasto operativo'];
        $statuses = ['PENDIENTE', 'CONCILIADO', 'NO_CONCILIADO'];
        $categorias = ['VENTA', 'COMPRA', 'SERVICIO', 'OTRO'];

        foreach ($createdAccounts as $account) {
            for ($i = 0; $i < 8; $i++) {
                $tipo = $tipos[array_rand($tipos)];
                $monto = rand(1000, 25000) + (rand(0, 99) / 100);
                $mes = rand(1, 3);
                $dia = rand(1, 28);
                $fecha = sprintf('2026-%02d-%02d', $mes, $dia);
                $desc = $tipo === 'DEPOSITO'
                    ? 'Ingreso por ' . $ingresosDesc[array_rand($ingresosDesc)]
                    : 'Egreso por ' . $egresosDesc[array_rand($egresosDesc)];

                BankMovement::create([
                    'cuenta_bancaria_id' => $account->id,
                    'tipo' => $tipo,
                    'monto' => $monto,
                    'referencia' => 'REF-' . str_pad($i + 1, 6, '0', STR_PAD_LEFT),
                    'descripcion' => $desc,
                    'conciliacion_status' => $statuses[array_rand($statuses)],
                    'transaccion_vinculada_id' => null,
                    'categoria' => $categorias[array_rand($categorias)],
                    'fecha' => $fecha,
                    'socio_id' => $admin->id,
                ]);
            }
        }
    }
}
