<?php

namespace Database\Factories;

use App\Models\BankAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class BankAccountFactory extends Factory
{
    protected $model = BankAccount::class;

    public function definition(): array
    {
        $bancos = ['BBVA', 'BANORTE', 'SANTANDER', 'BANAMEX', 'STP'];
        $tipos = ['CORRIENTE', 'AHORRO'];
        $monedas = ['MXN', 'USD'];

        return [
            'banco' => $this->faker->randomElement($bancos),
            'tipo_cuenta' => $this->faker->randomElement($tipos),
            'numero_cuenta' => $this->faker->unique()->numerify('################'),
            'moneda' => $this->faker->randomElement($monedas),
            'saldo' => $this->faker->randomFloat(2, 10000, 500000),
            'saldo_inicial' => $this->faker->randomFloat(2, 50000, 200000),
            'descripcion' => $this->faker->optional()->sentence(),
            'activo' => true,
            'socio_id' => User::where('rol', 'ADMIN')->inRandomOrder()->first()?->id,
        ];
    }
}
