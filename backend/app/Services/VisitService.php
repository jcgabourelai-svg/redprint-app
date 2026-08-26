<?php

namespace App\Services;

use App\Enums\VisitStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\PrinterHistory;
use App\Models\Visit;

class VisitService
{
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
     * Completa la visita exigiendo al menos una actividad registrada o un
     * motivo de cierre explicito. La visita no debe estar ya completada.
     */
    public function complete(Visit $visit, ?string $motivoCierre = null): Visit
    {
        if ($visit->estado === VisitStatus::COMPLETADA) {
            throw new BusinessRuleException('La visita ya está completada');
        }

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
}
