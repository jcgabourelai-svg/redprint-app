<?php

namespace App\Services;

use App\Enums\ContractStatus;
use App\Enums\FieldRecordStatus;
use App\Enums\FieldRecordType;
use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Exceptions\BusinessRuleException;
use App\Models\Contract;
use App\Models\FieldRecord;
use App\Models\Printer;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Support\Facades\DB;

class FieldRecordService
{
    public function __construct(
        private ContractService $contractService,
        private ReadingService $readingService,
        private DeliveryService $deliveryService,
        private VisitService $visitService
    ) {}

    /**
     * Alta de un registro de campo (staging). Idempotente por client_uuid:
     * un reintento de sync ambiguo devuelve la fila existente en vez de duplicar.
     */
    public function create(array $data, User $user): FieldRecord
    {
        if (! empty($data['client_uuid'])) {
            $existing = FieldRecord::where('client_uuid', $data['client_uuid'])->first();
            if ($existing) {
                return $existing;
            }
        }

        $data['socio_id'] = $user->id;
        $data['creado_por'] = $user->id;
        $data['estado'] = FieldRecordStatus::PENDIENTE;
        $data['capturado_en'] = $data['capturado_en'] ?? now();

        return FieldRecord::create($data);
    }

    /**
     * Regulariza un registro PENDIENTE contra entidades reales en una sola
     * transaccion: visita CAMPO + lectura (+ instalacion implicita si la
     * impresora estaba en almacen) o entregas con salida de stock.
     */
    public function link(FieldRecord $record, array $data, User $admin): FieldRecord
    {
        if ($record->estado !== FieldRecordStatus::PENDIENTE) {
            throw new BusinessRuleException('El registro ya fue regularizado y es inmutable');
        }

        return DB::transaction(function () use ($record, $data, $admin) {
            $contract = Contract::with('client')->findOrFail($data['contrato_id']);

            if ((int) $contract->cliente_id !== (int) $data['cliente_id']) {
                throw new BusinessRuleException('El contrato no pertenece al cliente seleccionado');
            }

            if ($contract->estado !== ContractStatus::ACTIVO) {
                throw new BusinessRuleException(
                    "El contrato {$contract->codigo_negocio} no está activo (estado: {$contract->estado->value}). Actívalo antes de vincular el registro."
                );
            }

            $socio = $record->socio;

            $visit = Visit::create([
                'cliente_id' => $contract->cliente_id,
                'contrato_id' => $contract->id,
                'tipo_visita' => $this->resolveVisitType($record, $data),
                'fecha_programada' => $record->capturado_en->toDateString(),
                'socio_id' => $socio->id,
                'estado' => VisitStatus::PENDIENTE,
                'notas' => $record->notas,
                'origen' => 'CAMPO',
                'creado_por' => $admin->id,
                'fecha_creacion' => now(),
            ]);

            $lecturaId = null;
            $impresoraId = null;

            if ($record->tipo === FieldRecordType::LECTURA) {
                $impresoraId = (int) $data['impresora_id'];
                $this->resolvePrinterForReading($contract, $impresoraId, $record, $admin, $visit->id);

                $reading = $this->readingService->captureReading([
                    'visita_id' => $visit->id,
                    'impresora_id' => $impresoraId,
                    'contrato_id' => $contract->id,
                    'fecha' => $record->capturado_en->toDateString(),
                    'valor_contador' => $record->valor_contador,
                    'foto_evidencia' => $record->foto_evidencia,
                    'justificacion_anomalia' => $data['justificacion_anomalia'] ?? null,
                    'ubicacion_lat' => $record->ubicacion_lat,
                    'ubicacion_lng' => $record->ubicacion_lng,
                ], $socio, $admin);

                $lecturaId = $reading->id;
            }

            if ($record->tipo === FieldRecordType::ENTREGA_INSUMOS) {
                foreach ($data['articulos'] ?? [] as $item) {
                    $this->deliveryService->deliver($visit, (int) $item['articulo_id'], (int) $item['cantidad'], $socio);
                }
            }

            $visit = $visit->fresh();
            if ($visit->estado === VisitStatus::PENDIENTE) {
                $this->visitService->complete($visit, $data['motivo_cierre'] ?? 'Regularizado desde registro de campo');
            }

            $record->update([
                'cliente_id' => $contract->cliente_id,
                'contrato_id' => $contract->id,
                'impresora_id' => $impresoraId,
                'visita_id' => $visit->id,
                'lectura_id' => $lecturaId,
                'vinculado_por' => $admin->id,
                'vinculado_en' => now(),
                'estado' => FieldRecordStatus::VINCULADO,
            ]);

            return $record->fresh(['client', 'contract', 'printer', 'visit', 'reading', 'socio', 'vinculadoPor']);
        });
    }

    public function discard(FieldRecord $record, string $motivo, User $admin): FieldRecord
    {
        if ($record->estado !== FieldRecordStatus::PENDIENTE) {
            throw new BusinessRuleException('El registro ya fue regularizado y es inmutable');
        }

        if (trim($motivo) === '') {
            throw new BusinessRuleException('El motivo de descarte es obligatorio');
        }

        $record->update([
            'estado' => FieldRecordStatus::DESCARTADO,
            'motivo_descarte' => trim($motivo),
            'vinculado_por' => $admin->id,
            'vinculado_en' => now(),
        ]);

        return $record->fresh(['socio', 'vinculadoPor']);
    }

    private function resolveVisitType(FieldRecord $record, array $data): VisitType
    {
        return match ($record->tipo) {
            FieldRecordType::LECTURA => VisitType::LECTURA,
            FieldRecordType::ENTREGA_INSUMOS => VisitType::ENTREGA_INSUMOS,
            FieldRecordType::OTRO => VisitType::from($data['tipo_visita']),
        };
    }

    /**
     * La impresora destino de la lectura debe estar activa en el contrato. Si
     * está en almacén se instala implicitamente con lectura_inicial = contador
     * capturado (linea base, no se cobra historico previo); cualquier otro
     * estado (rentada en otro contrato, etc.) exige resolucion manual.
     */
    private function resolvePrinterForReading(Contract $contract, int $printerId, FieldRecord $record, User $admin, int $visitaId): void
    {
        $printer = Printer::findOrFail($printerId);

        $alreadyActive = $contract->printers()
            ->where('impresora_id', $printer->id)
            ->wherePivot('activa', true)
            ->exists();

        if ($alreadyActive) {
            return;
        }

        if ($printer->estado === PrinterStatus::EN_ALMACEN) {
            $this->contractService->assignPrinter($contract, $printer->id, (int) $record->valor_contador, $admin, $visitaId);
            return;
        }

        throw new BusinessRuleException(
            "La impresora {$printer->num_serie} está {$printer->estado->value} y no pertenece al contrato. Libérala o corrige su estado en el catálogo antes de vincular."
        );
    }
}
