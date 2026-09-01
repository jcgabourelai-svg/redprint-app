<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Client;
use App\Models\Contract;
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
     * @param  array{cliente_id: int, contrato_id?: int|null, periodo_inicio: string, periodo_fin: string, notas?: string|null}
     * @return array{invoice: Invoice, advertencias: array}
     */
    public function createDraft(array $data, User $creator): array
    {
        [$invoice, $advertencias] = DB::transaction(function () use ($data, $creator) {
            $cliente = Client::findOrFail((int) $data['cliente_id']);

            return $this->crearBorradorInterno(
                $cliente,
                $data['periodo_inicio'],
                $data['periodo_fin'],
                isset($data['contrato_id']) ? (int) $data['contrato_id'] : null,
                $data['notas'] ?? null,
                $creator,
            );
        });

        return ['invoice' => $invoice->fresh(['client', 'details']), 'advertencias' => $advertencias];
    }

    /**
     * Nucleo compartido por createDraft y createDraftBatch. Debe ejecutarse
     * dentro de una transaccion del llamador.
     *
     * @return array{0: Invoice, 1: array}
     */
    private function crearBorradorInterno(
        Client $cliente,
        string $periodoInicio,
        string $periodoFin,
        ?int $contratoId,
        ?string $notas,
        User $creator,
    ): array {
        // D1: el monto SIEMPRE se calcula en el servidor; nunca se confia.
        // contratoId valida pertenencia al cliente + estado ACTIVO dentro.
        $calc = $this->calculationService->calcularEstimacion(
            $cliente->id,
            $periodoInicio,
            $periodoFin,
            null,
            $contratoId,
        );

        if ((float) $calc['monto_total'] <= 0.0) {
            throw new BusinessRuleException(
                'El calculo del periodo no genera monto a facturar (sin contratos activos o sin consumo). ' .
                'Si la factura ya fue timbrada en el PAC externo, registrala con el flujo de captura directa.'
            );
        }

        // Auto-derivacion (D19): si el calculo cubre exactamente un contrato,
        // el encabezado se llena con el (mono-contrato) aunque nadie lo pidio.
        $contratoFinal = $contratoId;
        if ($contratoFinal === null && count($calc['contratos']) === 1) {
            $contratoFinal = (int) $calc['contratos'][0]['contrato_id'];
        }

        // Bloqueo duro de periodo duplicado (D20): mismo cliente + rangos que
        // se intersectan + alcance de contrato solapado.
        $this->validarPeriodoNoDuplicado($cliente->id, $periodoInicio, $periodoFin, $contratoFinal, null);

        $invoice = Invoice::create([
            'numero_factura' => null,
            'cliente_id' => $cliente->id,
            'contrato_id' => $contratoFinal,
            'fecha_emision' => null,
            'fecha_vencimiento' => null,
            'periodo_inicio' => $periodoInicio,
            'periodo_fin' => $periodoFin,
            'monto_total' => $calc['monto_total'],
            'monto_pagado' => 0,
            'saldo_pendiente' => 0,
            'estado' => InvoiceStatus::BORRADOR,
            'notas' => $notas,
            'socio_id' => $creator->id,
            'creado_por' => $creator->id,
            'fecha_creacion' => now(),
        ]);

        // Los detalles del borrador reservan las lecturas: el indice
        // unico parcial impide que otra factura/borrador las reclame.
        $this->crearDetallesConProteccion($invoice, $calc['detalles']);

        return [$invoice, $calc['advertencias']];
    }

    /**
     * Batch de borradores por contrato con periodos fijos mensuales (D17/D18):
     * UNA transaccion all-or-nothing; un borrador por periodo, nunca
     * fusionados (cada mes conserva su tarifa base y sus paginas incluidas).
     *
     * @param  array{cliente_id: int, contrato_id: int, periodos: string[], notas?: string|null}
     * @return array<string, array{invoice: Invoice, advertencias: array}>por periodo Y-m
     */
    public function createDraftBatch(array $data, User $creator): array
    {
        $cliente = Client::findOrFail((int) $data['cliente_id']);
        $contrato = Contract::findOrFail((int) $data['contrato_id']);
        $notas = $data['notas'] ?? null;

        // Meses en orden cronologico (D18: un borrador por mes).
        $meses = collect($data['periodos'])
            ->unique()
            ->map(fn (string $periodo) => Carbon::createFromFormat('Y-m', $periodo)->startOfMonth())
            ->sortBy(fn (Carbon $mes) => $mes->format('Y-m'))
            ->values();

        return DB::transaction(function () use ($cliente, $contrato, $notas, $creator, $meses) {
            $resultados = [];

            foreach ($meses as $mes) {
                // Regla 3: bounds del mes calendario recortados a la vigencia
                // del contrato (primer/ultimo periodo parcial).
                $inicio = $mes->copy()->startOfMonth();
                $inicioContrato = $contrato->fecha_inicio->copy()->startOfDay();
                if ($inicioContrato->gt($inicio)) {
                    $inicio = $inicioContrato;
                }

                $fin = $mes->copy()->endOfMonth();
                if ($contrato->fecha_fin !== null) {
                    $finContrato = $contrato->fecha_fin->copy()->endOfDay();
                    if ($finContrato->lt($fin)) {
                        $fin = $finContrato;
                    }
                }

                if ($inicio->gt($fin)) {
                    throw new BusinessRuleException(sprintf(
                        'El periodo %s esta fuera de la vigencia del contrato.',
                        $mes->format('Y-m'),
                    ));
                }

                try {
                    [$invoice, $advertencias] = $this->crearBorradorInterno(
                        $cliente,
                        $inicio->toDateString(),
                        $fin->toDateString(),
                        (int) $contrato->id,
                        $notas,
                        $creator,
                    );
                } catch (BusinessRuleException $e) {
                    // Regla 4 (all-or-nothing): identificar el periodo fallido;
                    // la excepcion aborta y revierte toda la transaccion.
                    throw new BusinessRuleException(sprintf(
                        'El periodo %s no se pudo facturar: %s',
                        $mes->format('Y-m'),
                        $e->getMessage(),
                    ));
                }

                $resultados[$mes->format('Y-m')] = [
                    'invoice' => $invoice->fresh(['client', 'details']),
                    'advertencias' => $advertencias,
                ];
            }

            return $resultados;
        });
    }

    /**
     * Bloqueo duro de periodo duplicado (D20): facturas del cliente cuyo
     * [periodo_inicio, periodo_fin] intersecta el objetivo Y con alcance de
     * contrato solapado. Incluye borradores (reservan lecturas).
     */
    private function validarPeriodoNoDuplicado(
        int $clienteId,
        string $periodoInicio,
        string $periodoFin,
        ?int $contratoId,
        ?int $excluirFacturaId,
    ): void {
        $solapadas = Invoice::where('cliente_id', $clienteId)
            ->whereNotNull('periodo_inicio')
            ->whereNotNull('periodo_fin')
            ->where('periodo_inicio', '<=', $periodoFin)
            ->where('periodo_fin', '>=', $periodoInicio)
            ->when($excluirFacturaId, fn ($query, $id) => $query->where('id', '!=', $id))
            ->get(['id', 'numero_factura', 'contrato_id', 'periodo_inicio', 'periodo_fin']);

        foreach ($solapadas as $existente) {
            if ($this->alcanceSolapado($existente, $contratoId)) {
                throw new BusinessRuleException(sprintf(
                    'El periodo se solapa con la factura %s (%s a %s) del mismo alcance. ' .
                    'No se puede facturar dos veces el mismo periodo.',
                    $existente->numero_factura ?? ('borrador #' . $existente->id),
                    $existente->periodo_inicio->toDateString(),
                    $existente->periodo_fin->toDateString(),
                ));
            }
        }
    }

    /**
     * D20: el alcance solapa cuando el objetivo es a nivel cliente
     * (contrato_id null: cubre todo) o cuando la factura existente toca el
     * mismo contrato (por encabezado mono-contrato o por detalles).
     */
    private function alcanceSolapado(Invoice $existente, ?int $contratoId): bool
    {
        if ($contratoId === null) {
            return true;
        }

        if ($existente->contrato_id !== null && (int) $existente->contrato_id === $contratoId) {
            return true;
        }

        return $existente->details()->where('contrato_id', $contratoId)->exists();
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

            // Bloqueo duro de periodo duplicado (D20): re-chequeo dentro del
            // lock contra facturas creadas mientras el borrador esperaba
            // emision (excluyendose a si mismo).
            if ($locked->periodo_inicio !== null && $locked->periodo_fin !== null) {
                $this->validarPeriodoNoDuplicado(
                    (int) $locked->cliente_id,
                    $locked->periodo_inicio->toDateString(),
                    $locked->periodo_fin->toDateString(),
                    $locked->contrato_id !== null ? (int) $locked->contrato_id : null,
                    (int) $locked->id,
                );
            }

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

            // Un borrador mono-contrato conserva su alcance: se re-limita el
            // calculo a ese contrato (no muta a multi-contrato).
            $calc = $this->calculationService->calcularEstimacion(
                $invoice->cliente_id,
                $invoice->periodo_inicio->toDateString(),
                $invoice->periodo_fin->toDateString(),
                (int) $invoice->id,
                $invoice->contrato_id !== null ? (int) $invoice->contrato_id : null,
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
