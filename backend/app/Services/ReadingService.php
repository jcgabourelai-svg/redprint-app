<?php

namespace App\Services;

use App\Enums\VisitStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Reading;
use App\Models\Printer;
use App\Models\Visit;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ReadingService
{
    public function captureReading(array $data, User $creator): Reading
    {
        return DB::transaction(function () use ($data, $creator) {
            $printer = Printer::findOrFail($data['impresora_id']);
            $previousReading = $this->getPreviousReading($printer->id, $data['contrato_id']);
            $pagesConsumed = $data['valor_contador'] - $previousReading;

            $isAnomaly = $pagesConsumed < 0;
            if ($isAnomaly && empty($data['justificacion_anomalia'])) {
                throw new BusinessRuleException('Lectura anomala requiere justificacion');
            }

            $data['paginas_periodo'] = max(0, $pagesConsumed);
            $data['socio_id'] = $creator->id;
            $data['creado_por'] = $creator->id;
            $data['es_anomalia'] = $isAnomaly;
            $data['fecha_creacion'] = now();

            $reading = Reading::create($data);

            $printer->update(['contador_actual' => $data['valor_contador']]);

            $this->checkVisitCompletion($data['visita_id']);

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

    private function checkVisitCompletion(int $visitId): void
    {
        $visit = Visit::with('contract.activePrinters')->findOrFail($visitId);

        if ($visit->estado !== VisitStatus::PENDIENTE) {
            return;
        }

        $activePrinters = $visit->contract?->activePrinters ?? collect();

        if ($activePrinters->isEmpty()) {
            return;
        }

        $readingsForVisit = Reading::where('visita_id', $visitId)
            ->whereIn('impresora_id', $activePrinters->pluck('id'))
            ->count();

        if ($readingsForVisit >= $activePrinters->count()) {
            $visit->update([
                'estado' => VisitStatus::COMPLETADA,
                'fecha_realizada' => now(),
            ]);
        }
    }
}
