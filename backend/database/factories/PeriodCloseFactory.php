<?php

namespace Database\Factories;

use App\Models\PeriodClose;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PeriodCloseFactory extends Factory
{
    protected $model = PeriodClose::class;

    public function definition(): array
    {
        return [
            'periodo' => $this->faker->unique()->dateTimeBetween('-12 months', '-1 month')->format('Y-m'),
            'estado' => 'cerrado',
            'fecha_cierre' => $this->faker->dateTimeBetween('-12 months', '-1 month'),
            'cerrado_por' => User::where('rol', 'ADMIN')->inRandomOrder()->first()?->id,
            'ingresos' => $this->faker->randomFloat(2, 50000, 200000),
            'egresos' => $this->faker->randomFloat(2, 20000, 100000),
            'rentabilidad' => $this->faker->randomFloat(2, 10000, 100000),
            'facturas_emitidas' => $this->faker->numberBetween(5, 25),
            'facturas_pagadas' => $this->faker->numberBetween(3, 20),
            'facturas_pendientes' => $this->faker->numberBetween(0, 5),
            'gastos_registrados' => $this->faker->randomFloat(2, 5000, 50000),
            'movimientos_bancarios' => $this->faker->numberBetween(10, 50),
            'movimientos_conciliados' => $this->faker->numberBetween(8, 45),
            'movimientos_pendientes' => $this->faker->numberBetween(0, 5),
        ];
    }
}
