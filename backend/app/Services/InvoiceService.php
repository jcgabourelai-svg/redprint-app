<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
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

        // La fecha de vencimiento ya no es input libre: se deriva del cliente
        // (fecha_emision + dias_credito). Cualquier valor del payload se pisa.
        $data['fecha_vencimiento'] = $this->derivarVencimiento(
            Client::findOrFail((int) $data['cliente_id']),
            $data['fecha_emision'],
        );

        $data['creado_por'] = $creator->id;
        $data['socio_id'] = $creator->id;
        $data['estado'] = InvoiceStatus::PENDIENTE;
        $data['saldo_pendiente'] = $data['monto_total'];
        $data['monto_pagado'] = 0;
        $data['fecha_creacion'] = now();

        return DB::transaction(function () use ($data, $details) {
            $invoice = Invoice::create($data);
            $this->crearDetallesConProteccion($invoice, $details);

            return $invoice->fresh(['client', 'details']);
        });
    }

    /**
     * Crea un BORRADOR calculado por el sistema: reserva las lecturas del
     * periodo (via invoice_details) pero todavia no es cuenta por cobrar
     * (sin folio, sin fechas, saldo 0). Luego se "emite" con el folio real.
     *
     * @return array{invoice: Invoice, advertencias: array}
     */
    public function createDraft(array $data, User $creator): array
    {
        // D1: el monto SIEMPRE se calcula en el servidor; nunca se confia.
        $calc = $this->calculationService->calcularEstimacion(
            (int) $data['cliente_id'],
            $data['periodo_inicio'],
            $data['periodo_fin'],
        );

        if ((float) $calc['monto_total'] <= 0.0) {
            throw new BusinessRuleException(
                'El calculo del periodo no genera monto a facturar (sin contratos activos o sin consumo). ' .
                'Si la factura ya fue timbrada en el PAC externo, registrala con el flujo de captura directa.'
            );
        }

        $invoice = DB::transaction(function () use ($data, $calc, $creator) {
            $invoice = Invoice::create([
                'numero_factura' => null,
                'cliente_id' => (int) $data['cliente_id'],
                'contrato_id' => null,
                'fecha_emision' => null,
                'fecha_vencimiento' => null,
                'periodo_inicio' => $data['periodo_inicio'],
                'periodo_fin' => $data['periodo_fin'],
                'monto_total' => $calc['monto_total'],
                'monto_pagado' => 0,
                'saldo_pendiente' => 0,
                'estado' => InvoiceStatus::BORRADOR,
                'notas' => $data['notas'] ?? null,
                'socio_id' => $creator->id,
                'creado_por' => $creator->id,
                'fecha_creacion' => now(),
            ]);

            // Los detalles del borrador reservan las lecturas: el indice
            // unico parcial impide que otra factura/borrador las reclame.
            $this->crearDetallesConProteccion($invoice, $calc['detalles']);

            return $invoice->fresh(['client', 'details']);
        });

        return ['invoice' => $invoice, 'advertencias' => $calc['advertencias']];
    }

    /**
     * Emite un BORRADOR: le asigna folio real y fecha de emision, deriva el
     * vencimiento del credito del cliente y lo convierte en cuenta por cobrar.
     *
     * @param  array{numero_factura: string, fecha_emision: string}  $data
     */
    public function emitir(Invoice $invoice, array $data): Invoice
    {
        if ($invoice->estado !== InvoiceStatus::BORRADOR) {
            throw new BusinessRuleException('Solo se pueden emitir facturas en estado BORRADOR.');
        }

        if (empty($data['numero_factura']) || empty($data['fecha_emision'])) {
            throw new BusinessRuleException('El numero de factura y la fecha de emision son obligatorios para emitir.');
        }

        return DB::transaction(function () use ($invoice, $data) {
            // Re-fetch con lock: serializa contra destroy/recalcular concurrentes
            // y revalida el estado dentro de la transaccion.
            $locked = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if ($locked->estado !== InvoiceStatus::BORRADOR) {
                throw new BusinessRuleException('Solo se pueden emitir facturas en estado BORRADOR.');
            }

            if ((float) $locked->monto_total <= 0.0) {
                throw new BusinessRuleException(
                    'El borrador no tiene monto a facturar (el calculo dio 0). Eliminalo y crea uno nuevo.'
                );
            }

            if (Invoice::where('numero_factura', $data['numero_factura'])
                ->where('id', '!=', $locked->id)
                ->exists()
            ) {
                throw new BusinessRuleException(
                    'Ya existe una factura con el numero "' . $data['numero_factura'] . '".'
                );
            }

            // Fase 1: aqui ira el re-chequeo duro de solapamiento de periodos.

            try {
                $locked->update([
                    'numero_factura' => $data['numero_factura'],
                    'fecha_emision' => $data['fecha_emision'],
                    'fecha_vencimiento' => $this->derivarVencimiento($locked->client, $data['fecha_emision']),
                    'estado' => InvoiceStatus::PENDIENTE,
                    'saldo_pendiente' => $locked->monto_total,
                ]);
            } catch (QueryException $e) {
                // Respaldo del indice unique de numero_factura: dos emisiones
                // concurrentes con el mismo folio podrian pasar el chequeo y
                // colisionar al actualizar (unique_violation 23505).
                if (($e->errorInfo[0] ?? null) === '23505') {
                    throw new BusinessRuleException(
                        'Ya existe una factura con el numero "' . $data['numero_factura'] . '".'
                    );
                }
                throw $e;
            }

            return $locked->fresh(['client', 'details']);
        });
    }

    /**
     * Recalcula un BORRADOR con las lecturas actuales del periodo: libera sus
     * detalles, recalcula desde cero y vuelve a reservar las lecturas.
     *
     * @return array{invoice: Invoice, advertencias: array}
     */
    public function recalcular(Invoice $invoice): array
    {
        if ($invoice->estado !== InvoiceStatus::BORRADOR) {
            throw new BusinessRuleException('Solo se pueden recalcular facturas en estado BORRADOR.');
        }

        if ($invoice->periodo_inicio === null || $invoice->periodo_fin === null) {
            throw new BusinessRuleException('La factura no tiene periodo definido para recalcular.');
        }

        return DB::transaction(function () use ($invoice) {
            // Liberar primero las lecturas reservadas por este mismo borrador
            // para que el calculo pueda volver a incluirlas.
            $invoice->details()->delete();

            $calc = $this->calculationService->calcularEstimacion(
                $invoice->cliente_id,
                $invoice->periodo_inicio->toDateString(),
                $invoice->periodo_fin->toDateString(),
                (int) $invoice->id,
            );

            if ((float) $calc['monto_total'] <= 0.0) {
                // Misma guarda que createDraft: un borrador sin monto no tiene
                // sentido; se elimina en lugar de recalcularse a 0. La
                // excepcion revierte la transaccion (los detalles originales
                // quedan intactos).
                throw new BusinessRuleException(
                    'El recálculo del periodo no genera monto a facturar (sin contratos activos o sin consumo). ' .
                    'Elimina el borrador y crea uno nuevo si el periodo cambia.'
                );
            }

            $this->crearDetallesConProteccion($invoice, $calc['detalles']);

            $invoice->update(['monto_total' => $calc['monto_total']]);

            return [
                'invoice' => $invoice->fresh(['client', 'details']),
                'advertencias' => $calc['advertencias'],
            ];
        });
    }

    /**
     * Elimina (hard delete) un BORRADOR. Sin folio, sin pagos y sin CFDI no
     * hay historia que conservar; el cascade de invoice_details libera las
     * lecturas reservadas.
     */
    public function destroy(Invoice $invoice): void
    {
        if ($invoice->estado !== InvoiceStatus::BORRADOR) {
            throw new BusinessRuleException(
                'Solo se pueden eliminar facturas en estado BORRADOR. ' .
                'Las facturas emitidas conservan historia fiscal y de cobranza.'
            );
        }

        DB::transaction(fn () => $invoice->delete());
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
            ->where('estado', '!=', InvoiceStatus::BORRADOR)
            ->where('saldo_pendiente', '>', 0)
            ->whereNotNull('fecha_vencimiento')
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

    /**
     * Vencimiento derivado: fecha_emision + dias de credito del cliente.
     * Fuente de verdad del vencimiento en los flujos de facturas del sistema
     * (create/emitir ignoran cualquier fecha del payload). Excepcion conocida:
     * CfdiService::generateInvoice admite un override interno de
     * fecha_vencimiento explicito del flujo CFDI.
     */
    public function derivarVencimiento(Client $cliente, string $fechaEmision): string
    {
        $dias = (int) ($cliente->dias_credito ?? 30);

        return Carbon::parse($fechaEmision)->addDays($dias)->toDateString();
    }

    /**
     * Crea los detalles de una factura con doble proteccion contra doble
     * facturacion de lecturas: re-chequeo dentro de la transaccion mas la
     * captura de la violacion del indice unico parcial (23505) para el caso
     * de facturas concurrentes.
     *
     * @param  array<int, array{lectura_id?: int|null, ...}>  $details
     */
    private function crearDetallesConProteccion(Invoice $invoice, array $details): void
    {
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
    }
}
