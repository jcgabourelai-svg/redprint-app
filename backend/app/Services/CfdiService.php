<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Enums\TipoComprobante;
use App\Exceptions\BusinessRuleException;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\XmlComprobante;
use App\Services\Cfdi\CfdiParser;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class CfdiService
{
    public function __construct(
        private CfdiParser $parser
    ) {}

    /**
     * Importa uno o varios archivos XML. Recorre cada uno, lo parsea y lo
     * persiste como XmlComprobante (idempotente por UUID). Devuelve un
     * resultado por archivo.
     *
     * @param  UploadedFile[]  $uploadedFiles
     * @return list<array{archivo: string, estado: string, xml_comprobante: XmlComprobante|null, errores: string|null}>
     */
    public function importFiles(array $uploadedFiles, User $user): array
    {
        $resultados = [];

        foreach ($uploadedFiles as $file) {
            $nombre = $file->getClientOriginalName();

            try {
                $contenido = $file->getContent();
            } catch (\Throwable $e) {
                $resultados[] = $this->resultadoError($nombre, 'No se pudo leer el archivo.');
                continue;
            }

            try {
                $parsed = $this->parser->parse($contenido);
            } catch (BusinessRuleException $e) {
                $resultados[] = $this->resultadoError($nombre, $e->getMessage());
                continue;
            }

            $existente = XmlComprobante::with('invoice')->where('uuid', $parsed['uuid'])->first();
            if ($existente !== null) {
                $resultados[] = [
                    'archivo' => $nombre,
                    'estado' => 'duplicado',
                    'xml_comprobante' => $existente,
                    'errores' => null,
                ];
                continue;
            }

            try {
                $comprobante = $this->create($parsed, $user);
            } catch (BusinessRuleException $e) {
                $resultados[] = $this->resultadoError($nombre, $e->getMessage());
                continue;
            } catch (QueryException $e) {
                // TOCTOU: dos imports concurrentes del mismo UUID pueden pasar el
                // chequeo de existencia y colisionar en el unique(uuid). Se trata
                // como duplicado (no como error 500), igual que InvoiceService.
                if (($e->errorInfo[0] ?? null) === '23505') {
                    $resultados[] = [
                        'archivo' => $nombre,
                        'estado' => 'duplicado',
                        'xml_comprobante' => XmlComprobante::with('invoice')->where('uuid', $parsed['uuid'])->first(),
                        'errores' => null,
                    ];
                    continue;
                }
                throw $e;
            }

            $resultados[] = [
                'archivo' => $nombre,
                'estado' => 'importado',
                'xml_comprobante' => $comprobante,
                'errores' => null,
            ];
        }

        return $resultados;
    }

    /**
     * Crea un XmlComprobante a partir de un array parseado, resuelve el cliente
     * por RFC y, si procede, auto-enlaza una factura existente con el mismo
     * numero (Serie-Folio).
     *
     * @param  array<string,mixed>  $parsed
     */
    public function create(array $parsed, User $user): XmlComprobante
    {
        return DB::transaction(function () use ($parsed, $user) {
            // Auto-match receptor por RFC (no se crean clientes automaticamente).
            $receptorId = Client::where('rfc', $parsed['rfc_receptor'])->value('id');

            $data = $parsed;
            $data['receptor_id'] = $receptorId;
            $data['creado_por'] = $user->id;
            $data['fecha_creacion'] = now();

            $comprobante = XmlComprobante::create($data);

            foreach ($parsed['conceptos'] ?? [] as $concepto) {
                $comprobante->conceptos()->create($concepto);
            }

            // Auto-conciliacion: si es ingreso y coincide numero_factura con una
            // factura existente sin CFDI previo, se enlaza.
            $this->autoEnlazarFactura($comprobante);

            return $comprobante->fresh(['conceptos', 'receptor', 'invoice']);
        });
    }

    /**
     * Genera una Invoice del sistema a partir de un CFDI de ingreso.
     *
     * @param  array<string,mixed>  $overrides
     */
    public function generateInvoice(XmlComprobante $cfdi, User $user, array $overrides = []): Invoice
    {
        if ($cfdi->tipo_comprobante !== TipoComprobante::INGRESO) {
            throw new BusinessRuleException(
                'Solo se pueden generar facturas desde CFDI de ingreso (TipoDeComprobante = I).'
            );
        }

        if ($cfdi->receptor_id === null) {
            throw new BusinessRuleException(
                'El comprobante no tiene cliente asignado. Asigna un cliente antes de generar la factura.'
            );
        }

        $numeroFactura = $cfdi->serie_folio ?? ('UUID-' . substr($cfdi->uuid, 0, 8));
        $fechaEmision = $cfdi->fecha_emision->toDateString();
        $fechaVencimiento = $overrides['fecha_vencimiento'] ?? $fechaEmision;

        return DB::transaction(function () use ($cfdi, $user, $numeroFactura, $fechaEmision, $fechaVencimiento, $overrides) {
            // Relacion 1:1: el CFDI no debe tener ya una factura asociada.
            if (Invoice::where('xml_comprobante_id', $cfdi->id)->lockForUpdate()->exists()) {
                throw new BusinessRuleException('El comprobante ya tiene una factura asociada.');
            }

            if (Invoice::where('numero_factura', $numeroFactura)->exists()) {
                throw new BusinessRuleException(
                    "Ya existe una factura con el numero \"{$numeroFactura}\". " .
                    'Usa "Vincular" para conciliar este CFDI con la factura existente.'
                );
            }

            $invoice = Invoice::create([
                'numero_factura' => $numeroFactura,
                'cliente_id' => $cfdi->receptor_id,
                'contrato_id' => null,
                'fecha_emision' => $fechaEmision,
                'fecha_vencimiento' => $fechaVencimiento,
                'periodo_inicio' => null,
                'periodo_fin' => null,
                'monto_total' => $cfdi->total,
                'monto_pagado' => 0,
                'saldo_pendiente' => $cfdi->total,
                'estado' => InvoiceStatus::PENDIENTE,
                'notas' => $overrides['notas'] ?? "Generada desde CFDI {$cfdi->uuid}",
                'socio_id' => $user->id,
                'creado_por' => $user->id,
                'xml_comprobante_id' => $cfdi->id,
                'fecha_creacion' => now(),
            ]);

            return $invoice->fresh(['client', 'xmlComprobante']);
        });
    }

    /**
     * Vincula un CFDI a una factura ya registrada manualmente.
     */
    public function linkToInvoice(XmlComprobante $cfdi, int $invoiceId): Invoice
    {
        if ($cfdi->tipo_comprobante !== TipoComprobante::INGRESO) {
            throw new BusinessRuleException(
                'Solo se pueden vincular CFDI de ingreso (TipoDeComprobante = I) a facturas.'
            );
        }

        return DB::transaction(function () use ($cfdi, $invoiceId) {
            $invoice = Invoice::lockForUpdate()->findOrFail($invoiceId);

            if ($invoice->xml_comprobante_id !== null && $invoice->xml_comprobante_id !== $cfdi->id) {
                throw new BusinessRuleException('La factura ya esta vinculada a otro CFDI.');
            }

            // Relacion 1:1: el CFDI no debe estar ya vinculado a otra factura.
            $otraFactura = Invoice::where('xml_comprobante_id', $cfdi->id)
                ->where('id', '!=', $invoiceId)
                ->lockForUpdate()
                ->exists();
            if ($otraFactura) {
                throw new BusinessRuleException('El comprobante ya esta vinculado a otra factura.');
            }

            $invoice->xml_comprobante_id = $cfdi->id;
            $invoice->save();

            return $invoice->fresh(['client', 'xmlComprobante']);
        });
    }

    /**
     * Desvincula el CFDI de cualquier factura asociada.
     */
    public function unlink(XmlComprobante $cfdi): void
    {
        DB::transaction(function () use ($cfdi) {
            Invoice::where('xml_comprobante_id', $cfdi->id)->update([
                'xml_comprobante_id' => null,
            ]);
        });
    }

    /**
     * Asigna (o desasigna) el cliente del comprobante.
     */
    public function assignClient(XmlComprobante $cfdi, ?int $clientId, ?string $notas): XmlComprobante
    {
        $cfdi->receptor_id = $clientId;

        if ($notas !== null) {
            $cfdi->notas = $notas;
        }

        $cfdi->save();

        return $cfdi->fresh(['conceptos', 'receptor', 'invoice']);
    }

    /**
     * Elimina un comprobante. Bloqueado si esta enlazado a una factura.
     */
    public function delete(XmlComprobante $cfdi): void
    {
        if ($cfdi->invoice()->exists()) {
            throw new BusinessRuleException(
                'El comprobante esta vinculado a una factura. Desvincula primero.'
            );
        }

        $cfdi->delete();
    }

    /**
     * Intenta enlazar automaticamente el comprobante a una factura con el mismo
     * numero_factura (Serie-Folio) que aun no tenga CFDI. Solo aplica a ingresos.
     */
    private function autoEnlazarFactura(XmlComprobante $cfdi): void
    {
        if ($cfdi->tipo_comprobante !== TipoComprobante::INGRESO) {
            return;
        }

        if ($cfdi->serie_folio === null) {
            return;
        }

        $invoice = Invoice::where('numero_factura', $cfdi->serie_folio)
            ->whereNull('xml_comprobante_id')
            ->first();

        if ($invoice !== null) {
            $invoice->xml_comprobante_id = $cfdi->id;
            $invoice->save();
        }
    }

    /**
     * @return array{archivo: string, estado: string, xml_comprobante: null, errores: string}
     */
    private function resultadoError(string $archivo, string $mensaje): array
    {
        return [
            'archivo' => $archivo,
            'estado' => 'error',
            'xml_comprobante' => null,
            'errores' => $mensaje,
        ];
    }
}
