<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    public function __construct(
        private InvoiceCalculationService $calculationService
    ) {}

    public function create(array $data, User $creator): Invoice
    {
        $details = $data['detalles'] ?? [];
        unset($data['detalles']);

        // La presencia de detalles indica modo "lecturas": en ese caso los
        // montos NUNCA se confian al cliente; se recalculan en el servidor a
        // partir del cliente y el periodo. Si faltan los datos necesarios se
        // rechaza la operacion en lugar de caer en confiar el monto enviado.
        if (!empty($details)) {
            if (empty($data['cliente_id']) || empty($data['periodo_inicio']) || empty($data['periodo_fin'])) {
                throw new BusinessRuleException(
                    'Cuando se envian detalles de facturacion es obligatorio indicar cliente, periodo_inicio y periodo_fin.'
                );
            }

            $calc = $this->calculationService->calcularEstimacion(
                (int) $data['cliente_id'],
                $data['periodo_inicio'],
                $data['periodo_fin'],
            );
            $data['monto_total'] = $calc['monto_total'];
            $details = $calc['detalles'];
        }

        $data['creado_por'] = $creator->id;
        $data['socio_id'] = $creator->id;
        $data['estado'] = InvoiceStatus::PENDIENTE;
        $data['saldo_pendiente'] = $data['monto_total'];
        $data['monto_pagado'] = 0;
        $data['fecha_creacion'] = now();

        return DB::transaction(function () use ($data, $details) {
            // Prevencion de doble facturacion: re-validar dentro de la transaccion
            // que ninguna lectura_id de los detalles ya exista en invoice_details.
            $lecturaIds = array_filter(array_map(
                fn ($d) => $d['lectura_id'] ?? null,
                $details,
            ));

            if (!empty($lecturaIds)) {
                $yaFacturadas = DB::table('invoice_details')
                    ->whereIn('lectura_id', $lecturaIds)
                    ->pluck('lectura_id')
                    ->all();

                if (!empty($yaFacturadas)) {
                    throw new BusinessRuleException(
                        'Una o mas lecturas ya fueron facturadas (IDs: ' . implode(', ', $yaFacturadas) . '). ' .
                        'Recalcula la factura para el periodo seleccionado.'
                    );
                }
            }

            $invoice = Invoice::create($data);

            try {
                foreach ($details as $detail) {
                    $invoice->details()->create($detail);
                }
            } catch (QueryException $e) {
                // Respaldo del indice unico parcial: dos facturas concurrentes
                // del mismo periodo podrian pasar el chequeo y colisionar al
                // insertar (unique_violation 23505).
                if (($e->errorInfo[0] ?? null) === '23505') {
                    throw new BusinessRuleException(
                        'Una o mas lecturas ya fueron facturadas por otra factura concurrente. ' .
                        'Recalcula la factura para el periodo seleccionado.'
                    );
                }
                throw $e;
            }

            return $invoice->fresh(['client', 'details']);
        });
    }

    public function updateStatusAutomatic(Invoice $invoice): Invoice
    {
        if ($invoice->saldo_pendiente <= 0) {
            $invoice->update(['estado' => InvoiceStatus::PAGADA, 'saldo_pendiente' => 0]);
        } elseif ($invoice->monto_pagado > 0) {
            if ($invoice->estado !== InvoiceStatus::VENCIDA && $invoice->estado !== InvoiceStatus::INCOBRABLE) {
                $invoice->update(['estado' => InvoiceStatus::PARCIALMENTE_PAGADA]);
            }
        }

        return $invoice->fresh();
    }

    public function checkOverdue(): int
    {
        return Invoice::where('estado', '!=', InvoiceStatus::PAGADA)
            ->where('estado', '!=', InvoiceStatus::INCOBRABLE)
            ->where('saldo_pendiente', '>', 0)
            ->where('fecha_vencimiento', '<', now())
            ->update(['estado' => InvoiceStatus::VENCIDA]);
    }

    public function getOutstandingBalance(?int $clientId = null): float
    {
        $query = Invoice::whereIn('estado', [
            InvoiceStatus::PENDIENTE,
            InvoiceStatus::PARCIALMENTE_PAGADA,
            InvoiceStatus::VENCIDA,
        ]);

        if ($clientId) {
            $query->where('cliente_id', $clientId);
        }

        return $query->sum('saldo_pendiente');
    }
}
