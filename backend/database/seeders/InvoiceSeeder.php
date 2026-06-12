<?php

namespace Database\Seeders;

use App\Enums\InvoiceStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Database\Seeder;

class InvoiceSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('rol', 'ADMIN')->first();
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

            Invoice::create([
                'numero_factura' => 'F-' . str_pad($i, 6, '0', STR_PAD_LEFT),
                'cliente_id' => $client->id,
                'contrato_id' => $contract?->id,
                'fecha_emision' => $emision,
                'fecha_vencimiento' => $vencimiento,
                'periodo_inicio' => $emision->copy()->startOfMonth(),
                'periodo_fin' => $emision->copy()->endOfMonth(),
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
    }
}
