<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\Reading;
use App\Models\Printer;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Support\Facades\DB;

class ReadingService
{
    public function __construct(
        private VisitService $visitService
    ) {}

    /**
     * $creator es el socio que capturó la lectura (dueño del negocio);
     * $creadoPor (opcional) es quien registró la fila — difiere cuando la
     * lectura se regulariza desde un registro de campo: el socio es el
     * operador de campo y el creador el admin que vinculó.
     */
    public function captureReading(array $data, User $creator, ?User $creadoPor = null): Reading
    {
        return DB::transaction(function () use ($data, $creator, $creadoPor) {
            // lockForUpdate: serializa el doble submit contra la misma visita
            // (la guardia es check-then-act; sin lock dos capturas simultaneas
            // pasarian ambas y duplicarian lecturas facturables).
            $visit = Visit::whereKey($data['visita_id'])->lockForUpdate()->firstOrFail();
            $this->visitService->assertCapturable($visit);

            $printer = Printer::findOrFail($data['impresora_id']);
            $previousReading = $this->getPreviousReading($printer->id, $data['contrato_id']);
            $pagesConsumed = $data['valor_contador'] - $previousReading;

            $isAnomaly = $pagesConsumed < 0;
            if ($isAnomaly && empty($data['justificacion_anomalia'])) {
                throw new BusinessRuleException('Lectura anomala requiere justificacion');
            }

            $data['paginas_periodo'] = max(0, $pagesConsumed);
            $data['socio_id'] = $creator->id;
            $data['creado_por'] = ($creadoPor ?? $creator)->id;
            $data['es_anomalia'] = $isAnomaly;
            $data['fecha_creacion'] = now();

            $reading = Reading::create($data);

            $printer->update(['contador_actual' => $data['valor_contador']]);

            return $reading;
        });
    }

    public function calculatePagesConsumed(int $printerId, int $contractId, int $currentValue): int
    {
        $previous = $this->getPreviousReading($printerId, $contractId);
        return max(0, $currentValue - $previous);
    }

    public function validateReadingAnomaly(int $printerId, int $contractId, int $currentValue): bool
    {
        $previous = $this->getPreviousReading($printerId, $contractId);
        return $currentValue < $previous;
    }

    public function processMultipleReadings(array $readings, User $creator): array
    {
        $results = [];
        foreach ($readings as $readingData) {
            $readingData['contrato_id'] = $readingData['contrato_id'] ?? null;
            $readingData['fecha'] = $readingData['fecha'] ?? now()->format('Y-m-d');
            $results[] = $this->captureReading($readingData, $creator);
        }
        return $results;
    }

    private function getPreviousReading(int $printerId, ?int $contractId): int
    {
        $query = Reading::where('impresora_id', $printerId);

        if ($contractId) {
            $query->where('contrato_id', $contractId);
        }

        $lastReading = $query->orderBy('fecha', 'desc')->orderBy('id', 'desc')->first();

        if (!$lastReading) {
            $pivot = \DB::table('contract_printer')
                ->where('impresora_id', $printerId)
                ->where('activa', true)
                ->value('lectura_inicial');

            return $pivot ?? 0;
        }

        return $lastReading->valor_contador;
    }
}
