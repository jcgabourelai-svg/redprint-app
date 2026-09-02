<?php

namespace Database\Seeders;

use App\Enums\InvoiceStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\User;
use App\Support\CicloFacturacion;
use Illuminate\Database\Seeder;

class InvoiceSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::administradores()->first();
        $clients = Client::all();
        $statuses = [InvoiceStatus::PENDIENTE, InvoiceStatus::PAGADA, InvoiceStatus::PARCIALMENTE_PAGADA, InvoiceStatus::VENCIDA];

        for ($i = 1; $i <= 20; $i++) {
            $client = $clients->random();
            $contract = $client->contracts()->first();

            $montoTotal = rand(2000, 15000) + (rand(0, 99) / 100);
            $montoPagado = 0;
            $status = $statuses[array_rand($statuses)];

            if ($status === InvoiceStatus::PAGADA) {
                $montoPagado = $montoTotal;
            } elseif ($status === InvoiceStatus::PARCIALMENTE_PAGADA) {
                $montoPagado = $montoTotal * (rand(20, 80) / 100);
            }

            $emision = now()->subDays(rand(1, 90));
            $vencimiento = $emision->copy()->addDays(rand(15, 45));

            // Periodos por ciclo de aniversario del contrato (D17); sin
            // contrato no hay ancla de ciclo y se usa el mes calendario.
            $bounds = $this->boundsDeCiclo($contract);
            $periodoInicio = $bounds['inicio'];
            $periodoFin = $bounds['fin'];

            Invoice::create([
                'numero_factura' => 'F-' . str_pad($i, 6, '0', STR_PAD_LEFT),
                'cliente_id' => $client->id,
                'contrato_id' => $contract?->id,
                'fecha_emision' => $emision,
                'fecha_vencimiento' => $vencimiento,
                'periodo_inicio' => $periodoInicio,
                'periodo_fin' => $periodoFin,
                'monto_total' => $montoTotal,
                'monto_pagado' => $montoPagado,
                'saldo_pendiente' => $montoTotal - $montoPagado,
                'estado' => $status,
                'notas' => rand(0, 1) ? 'Factura por servicios de renta' : null,
                'socio_id' => $admin->id,
                'creado_por' => $admin->id,
                'fecha_creacion' => now(),
            ]);
        }

        // Borradores demo: calculo previo a la emision (sin folio, sin
        // fechas, sin saldo) sobre el ciclo en curso del contrato.
        for ($i = 21; $i <= 22; $i++) {
            $client = $clients->random();
            $contract = $client->contracts()->first();

            $bounds = $this->boundsDeCiclo($contract);

            Invoice::create([
                'numero_factura' => null,
                'cliente_id' => $client->id,
                'contrato_id' => $contract?->id,
                'fecha_emision' => null,
                'fecha_vencimiento' => null,
                'periodo_inicio' => $bounds['inicio'],
                'periodo_fin' => $bounds['fin'],
                'monto_total' => rand(2000, 15000) + (rand(0, 99) / 100),
                'monto_pagado' => 0,
                'saldo_pendiente' => 0,
                'estado' => InvoiceStatus::BORRADOR,
                'notas' => 'Borrador demo',
                'socio_id' => $admin->id,
                'creado_por' => $admin->id,
                'fecha_creacion' => now(),
            ]);
        }
    }

    /**
     * Bounds de un ciclo aleatorio dentro de la vigencia del contrato (el
     * ultimo si el contrato ya finalizo). Sin contrato: mes calendario.
     *
     * @return array{inicio: \Illuminate\Support\Carbon, fin: \Illuminate\Support\Carbon}
     */
    private function boundsDeCiclo(?Contract $contract): array
    {
        if ($contract === null) {
            return [
                'inicio' => now()->startOfMonth(),
                'fin' => now()->endOfMonth(),
            ];
        }

        $referencia = $contract->fecha_fin ?? now();
        $ultimoCiclo = max(0, CicloFacturacion::cicloQueContiene($contract, $referencia));

        return CicloFacturacion::bounds($contract, rand(0, $ultimoCiclo));
    }
}
