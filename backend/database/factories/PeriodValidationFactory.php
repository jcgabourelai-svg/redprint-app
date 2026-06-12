<?php

namespace Database\Factories;

use App\Models\PeriodClose;
use App\Models\PeriodValidation;
use Illuminate\Database\Eloquent\Factories\Factory;

class PeriodValidationFactory extends Factory
{
    protected $model = PeriodValidation::class;

    public function definition(): array
    {
        $nombres = [
            'facturas_pendientes',
            'movimientos_conciliados',
            'saldos_verificados',
            'inventario_cuadrado',
        ];
        $estados = ['ok', 'warning', 'error'];

        return [
            'period_close_id' => PeriodClose::inRandomOrder()->first()?->id,
            'nombre' => $this->faker->randomElement($nombres),
            'estado' => $this->faker->randomElement($estados),
            'mensaje' => $this->faker->optional()->sentence(),
            'link' => $this->faker->optional()->url(),
        ];
    }
}
