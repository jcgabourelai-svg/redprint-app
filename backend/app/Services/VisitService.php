<?php

namespace App\Services;

use App\Enums\VisitStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\PrinterHistory;
use App\Models\Visit;

class VisitService
{
    /**
     * Maximo de dias hacia el futuro en que una visita admite captura de
     * actividades o cierre (D21). Capturar o cerrar una visita mas lejana
     * "quema" el slot del ciclo y deja el contrato sin visita hasta el
     * siguiente aniversario.
     */
    public const MAX_DIAS_ADELANTO = 5;

    /**
     * True si la visita tiene al menos una actividad registrada: lectura,
     * entrega de insumos, orden de mantenimiento vinculada o un cambio de
     * impresora (instalacion/retiro) estampado con visita_id.
     */
    public function hasRegisteredActivity(Visit $visit): bool
    {
        if ($visit->readings()->exists()) {
            return true;
        }

        if ($visit->deliveries()->exists()) {
            return true;
        }

        if ($visit->maintenanceOrders()->exists()) {
            return true;
        }

        return PrinterHistory::query()
            ->where('datos_adicionales->visita_id', $visit->id)
            ->whereIn('tipo_evento', ['ASIGNACION_CONTRATO', 'LIBERACION_CONTRATO'])
            ->exists();
    }

    /**
     * Guardia de captura (D21): la visita debe estar en un estado abierto
     * (PENDIENTE/REPROGRAMADA) y programada a lo mas MAX_DIAS_ADELANTO dias
     * en el futuro. Es el unico punto de la regla: lo consumen la captura de
     * lecturas (ReadingService) y el cierre de visitas (complete).
     */
    public function assertCapturable(Visit $visit): void
    {
        if (! in_array($visit->estado, [VisitStatus::PENDIENTE, VisitStatus::REPROGRAMADA], true)) {
            throw new BusinessRuleException(
                "La visita está {$visit->estado->value} y no admite captura de actividades."
            );
        }

        $this->assertWithinCaptureWindow($visit);
    }

    /**
     * Completa la visita exigiendo al menos una actividad registrada o un
     * motivo de cierre explicito. La visita no debe estar ya completada.
     */
    public function complete(Visit $visit, ?string $motivoCierre = null): Visit
    {
        if ($visit->estado === VisitStatus::COMPLETADA) {
            throw new BusinessRuleException('La visita ya está completada');
        }

        if (in_array($visit->estado, [VisitStatus::CANCELADA, VisitStatus::OMITIDA], true)) {
            throw new BusinessRuleException(
                "La visita está {$visit->estado->value} y no puede completarse."
            );
        }

        $this->assertWithinCaptureWindow($visit);

        if (! $this->hasRegisteredActivity($visit) && empty($motivoCierre)) {
            throw new BusinessRuleException('La visita no tiene actividades registradas: indica un motivo de cierre');
        }

        $visit->update([
            'estado' => VisitStatus::COMPLETADA,
            'fecha_realizada' => now(),
            'motivo_cierre' => $motivoCierre ?: $visit->motivo_cierre,
        ]);

        return $visit->fresh();
    }

    /**
     * Ventana de captura (D21): la fecha programada no puede superar
     * MAX_DIAS_ADELANTO dias hacia el futuro desde hoy. El dia de negocio
     * se toma en America/Cancun (la app corre en UTC): entre 18:00 y 23:59
     * locales el dia UTC ya es manana y la ventana se ensancharia un dia.
     */
    private function assertWithinCaptureWindow(Visit $visit): void
    {
        if ($visit->fecha_programada->startOfDay()->gt(today('America/Cancun')->addDays(self::MAX_DIAS_ADELANTO))) {
            throw new BusinessRuleException(sprintf(
                'La visita está programada para el %s, a más de %d días en el futuro. Reprograma la visita o crea una nueva.',
                $visit->fecha_programada->format('d/m/Y'),
                self::MAX_DIAS_ADELANTO,
            ));
        }
    }
}
