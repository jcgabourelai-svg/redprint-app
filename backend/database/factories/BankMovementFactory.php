<?php

namespace Database\Factories;

use App\Models\BankAccount;
use App\Models\BankMovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class BankMovementFactory extends Factory
{
    protected $model = BankMovement::class;

    public function definition(): array
    {
        $tipos = ['DEPOSITO', 'RETIRO'];
        $statuses = ['PENDIENTE', 'CONCILIADO', 'NO_CONCILIADO'];
        $tipo = $this->faker->randomElement($tipos);

        return [
            'cuenta_bancaria_id' => BankAccount::inRandomOrder()->first()?->id,
            'tipo' => $tipo,
            'monto' => $this->faker->randomFloat(2, 500, 50000),
            'referencia' => $this->faker->optional()->numerify('REF-##########'),
            'descripcion' => $this->faker->optional()->sentence(),
            'conciliacion_status' => $this->faker->randomElement($statuses),
            'transaccion_vinculada_id' => null,
            'categoria' => $this->faker->optional()->randomElement(['VENTA', 'COMPRA', 'SERVICIO', 'OTRO']),
            'fecha' => $this->faker->dateTimeBetween('-6 months', 'now')->format('Y-m-d'),
            'socio_id' => User::where('rol', 'ADMIN')->inRandomOrder()->first()?->id,
        ];
    }
}
