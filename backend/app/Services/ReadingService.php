<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\Reading;
use App\Models\Printer;
use App\Models\ContractPrinter;
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

            // Salto positivo atipico: con historial suficiente (>=3 lecturas
            // del contrato) y delta > max(2 x mayor delta historico, 5000) se
            // exige justificacion y se marca como anomalia (probable captura
            // con digitos extras o unidad equivocada).
            $umbral = $this->umbralAnomalia($data['contrato_id'] ?? null);
            if (!$isAnomaly && $umbral !== null && $pagesConsumed > $umbral) {
                $isAnomaly = true;
                if (empty($data['justificacion_anomalia'])) {
                    throw new BusinessRuleException(
                        "El salto de {$pagesConsumed} paginas supera el umbral esperado ({$umbral}); requiere justificacion"
                    );
                }
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

    /**
     * Umbral de anomalía positiva para el contrato: max(2 x mayor delta
     * histórico, 5000), solo si el contrato ya tiene >= 3 lecturas (sin
     * historial suficiente cualquier delta es plausible). Null = sin umbral.
     */
    public function umbralAnomalia(?int $contratoId): ?int
    {
        if ($contratoId === null) {
            return null;
        }

        $previas = Reading::where('contrato_id', $contratoId)->count();
        if ($previas < 3) {
            return null;
        }

        $maxHistorico = (int) Reading::where('contrato_id', $contratoId)->max('paginas_periodo');

        return max(2 * $maxHistorico, 5000);
    }

    /**
     * Baseline por asignación (ventana): si existe un pivot ACTIVO del par
     * (impresora, contrato), la baseline es la última lectura del par con
     * fecha >= fecha_asignacion de esa ventana, o su lectura_inicial si no
     * hay ninguna. Así, al re-ingresar una impresora tras taller, las páginas
     * de pruebas del taller no se facturan. Sin asignación activa (lecturas
     * sin contrato, talleres) se conserva el comportamiento histórico.
     */
    public function getPreviousReading(int $printerId, ?int $contractId): int
    {
        if ($contractId !== null) {
            $pivot = ContractPrinter::where('impresora_id', $printerId)
                ->where('contrato_id', $contractId)
                ->where('activa', true)
                ->orderByDesc('id')
                ->first(['id', 'fecha_asignacion', 'lectura_inicial']);

            if ($pivot !== null) {
                $lastReading = Reading::where('impresora_id', $printerId)
                    ->where('contrato_id', $contractId)
                    ->where('fecha', '>=', $pivot->fecha_asignacion->toDateString())
                    ->orderBy('fecha', 'desc')
                    ->orderBy('id', 'desc')
                    ->first(['valor_contador']);

                return $lastReading !== null
                    ? (int) $lastReading->valor_contador
                    : (int) ($pivot->lectura_inicial ?? 0);
            }
        }

        $query = Reading::where('impresora_id', $printerId);

        if ($contractId) {
            $query->where('contrato_id', $contractId);
        }

        $lastReading = $query->orderBy('fecha', 'desc')->orderBy('id', 'desc')->first();

        if (!$lastReading) {
            $pivot = DB::table('contract_printer')
                ->where('impresora_id', $printerId)
                ->where('activa', true)
                ->value('lectura_inicial');

            return $pivot ?? 0;
        }

        return $lastReading->valor_contador;
    }
}
