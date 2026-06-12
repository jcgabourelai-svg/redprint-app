<?php

namespace App\Services;

use App\Enums\PrinterStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Printer;
use App\Models\PrinterHistory;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PrinterService
{
    public function __construct(
        private CodeGeneratorService $codeGenerator
    ) {}

    public function create(array $data, User $creator): Printer
    {
        return DB::transaction(function () use ($data, $creator) {
            $data['codigo_negocio'] = $this->codeGenerator->generatePrinterCode();
            $data['creado_por'] = $creator->id;
            $data['estado'] = PrinterStatus::EN_ALMACEN;
            $data['fecha_creacion'] = now();

            $printer = Printer::create($data);

            PrinterHistory::create([
                'impresora_id' => $printer->id,
                'tipo_evento' => 'ADQUISICION',
                'descripcion' => 'Impresora registrada en el sistema',
                'socio_id' => $creator->id,
                'fecha' => now(),
            ]);

            return $printer;
        });
    }

    public function update(Printer $printer, array $data): Printer
    {
        $printer->update($data);
        return $printer->fresh();
    }

    public function changeStatus(Printer $printer, PrinterStatus $newStatus, User $user, ?string $reason = null): Printer
    {
        $this->validateStatusTransition($printer->estado, $newStatus);

        return DB::transaction(function () use ($printer, $newStatus, $user, $reason) {
            $oldStatus = $printer->estado;

            $printer->update(['estado' => $newStatus]);

            PrinterHistory::create([
                'impresora_id' => $printer->id,
                'tipo_evento' => 'CAMBIO_ESTADO',
                'descripcion' => "Estado cambiado de {$oldStatus->value} a {$newStatus->value}",
                'datos_adicionales' => [
                    'estado_anterior' => $oldStatus->value,
                    'estado_nuevo' => $newStatus->value,
                    'razon' => $reason,
                ],
                'socio_id' => $user->id,
                'fecha' => now(),
            ]);

            return $printer->fresh();
        });
    }

    public function deactivate(Printer $printer, User $user, string $reason): Printer
    {
        if ($printer->estado === PrinterStatus::RENTADA) {
            throw new BusinessRuleException('No se puede dar de baja una impresora rentada');
        }

        return $this->changeStatus($printer, PrinterStatus::DADA_DE_BAJA, $user, $reason);
    }

    public function getHistory(Printer $printer, ?string $eventType = null)
    {
        $query = $printer->history()->with('socio');

        if ($eventType) {
            $query->where('tipo_evento', $eventType);
        }

        return $query->orderBy('fecha', 'desc')->paginate(20);
    }

    public function validateStatusTransition(PrinterStatus $current, PrinterStatus $new): void
    {
        if ($current === PrinterStatus::DADA_DE_BAJA) {
            throw new BusinessRuleException('No se puede cambiar el estado de una impresora dada de baja');
        }

        if ($current === PrinterStatus::RENTADA && $new === PrinterStatus::DADA_DE_BAJA) {
            throw new BusinessRuleException('No se puede dar de baja una impresora rentada');
        }
    }
}
