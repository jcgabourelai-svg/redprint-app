<?php

namespace App\Services;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Contract;
use App\Models\ContractPrinter;
use App\Models\Printer;
use App\Models\PrinterHistory;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class ContractService
{
    public function __construct(
        private CodeGeneratorService $codeGenerator,
        private VisitSchedulerService $visitScheduler
    ) {}

    public function create(array $data, User $creator): Contract
    {
        return DB::transaction(function () use ($data, $creator) {
            $data['codigo_negocio'] = $this->codeGenerator->generateContractCode();
            $data['creado_por'] = $creator->id;
            $data['estado'] = ContractStatus::ACTIVO;
            $data['fecha_creacion'] = now();

            $printerIds = $data['impresoras'] ?? [];
            unset($data['impresoras']);

            $contract = Contract::create($data);

            foreach ($printerIds as $printerData) {
                $this->assignPrinter(
                    $contract,
                    $printerData['id'],
                    $printerData['lectura_inicial'] ?? 0,
                    $creator,
                    null,
                    $printerData['alias'] ?? null
                );
            }

            $contract = $contract->fresh(['client', 'printers']);

            // Genera la 1ra visita recurrente (rolling) sin esperar al cron,
            // dentro de la misma transaccion para garantizar atomicidad.
            $this->visitScheduler->generateNextCycle($contract, $creator->id);

            return $contract;
        });
    }

    public function activate(Contract $contract, User $user): Contract
    {
        if ($contract->estado !== ContractStatus::SUSPENDIDO) {
            throw new BusinessRuleException('Solo se pueden activar contratos suspendidos');
        }

        $contract->update(['estado' => ContractStatus::ACTIVO]);
        return $contract->fresh();
    }

    public function suspend(Contract $contract, User $user): Contract
    {
        if ($contract->estado !== ContractStatus::ACTIVO) {
            throw new BusinessRuleException('Solo se pueden suspender contratos activos');
        }

        $contract->update(['estado' => ContractStatus::SUSPENDIDO]);
        return $contract->fresh();
    }

    public function finish(Contract $contract, int $warehouseId, User $user): Contract
    {
        if ($contract->estado !== ContractStatus::ACTIVO) {
            throw new BusinessRuleException('Solo se pueden finalizar contratos activos');
        }

        return DB::transaction(function () use ($contract, $warehouseId, $user) {
            $contract->update(['estado' => ContractStatus::FINALIZADO]);

            $this->visitScheduler->cancelFutureVisits($contract);

            foreach ($contract->activePrinters as $printer) {
                $this->releasePrinter($contract, $printer, $warehouseId, $user);
            }

            return $contract->fresh(['client', 'printers']);
        });
    }

    public function cancel(Contract $contract, int $warehouseId, User $user): Contract
    {
        return DB::transaction(function () use ($contract, $warehouseId, $user) {
            $contract->update(['estado' => ContractStatus::CANCELADO]);

            $this->visitScheduler->cancelFutureVisits($contract);

            foreach ($contract->activePrinters as $printer) {
                $this->releasePrinter($contract, $printer, $warehouseId, $user);
            }

            return $contract->fresh(['client', 'printers']);
        });
    }

    public function assignPrinter(Contract $contract, int $printerId, int $initialReading, User $user, ?int $visitaId = null, ?string $alias = null): void
    {
        $printer = Printer::findOrFail($printerId);

        if ($printer->estado !== PrinterStatus::EN_ALMACEN) {
            throw new BusinessRuleException('La impresora debe estar en almacen para asignarla');
        }

        $alreadyAssigned = Contract::whereHas('printers', function ($q) use ($printerId) {
            $q->where('impresora_id', $printerId)->where('activa', true);
        })->where('estado', ContractStatus::ACTIVO)->exists();

        if ($alreadyAssigned) {
            throw new BusinessRuleException('La impresora ya esta asignada a un contrato activo');
        }

        $alias = $this->normalizarAlias($alias);

        if ($alias !== null) {
            $aliasDuplicado = ContractPrinter::where('contrato_id', $contract->id)
                ->where('alias', $alias)
                ->where('activa', true)
                ->exists();

            if ($aliasDuplicado) {
                throw new BusinessRuleException("El alias '{$alias}' ya está en uso en una asignación activa de este contrato");
            }
        }

        try {
            $contract->printers()->attach($printerId, [
                'fecha_asignacion' => now(),
                'lectura_inicial' => $initialReading,
                'activa' => true,
                'alias' => $alias,
            ]);
        } catch (UniqueConstraintViolationException) {
            // Backstop: el indice parcial (contrato_id, alias) WHERE activa
            // garantiza la unicidad incluso bajo concurrencia.
            throw new BusinessRuleException(
                $alias !== null
                    ? "El alias '{$alias}' ya está en uso en una asignación activa de este contrato"
                    : 'La impresora ya tiene una asignación registrada en este contrato'
            );
        }

        $printer->update([
            'estado' => PrinterStatus::RENTADA,
            'almacen_id' => null,
        ]);

        $datosAdicionales = ['contrato_id' => $contract->id];
        if ($visitaId) {
            $datosAdicionales['visita_id'] = $visitaId;
        }
        if ($alias !== null) {
            $datosAdicionales['alias'] = $alias;
        }

        PrinterHistory::create([
            'impresora_id' => $printer->id,
            'tipo_evento' => 'ASIGNACION_CONTRATO',
            'descripcion' => "Asignada al contrato {$contract->codigo_negocio}",
            'datos_adicionales' => $datosAdicionales,
            'socio_id' => $user->id,
            'fecha' => now(),
        ]);
    }

    public function releasePrinter(Contract $contract, Printer $printer, int $warehouseId, User $user, ?int $visitaId = null): void
    {
        $alias = ContractPrinter::where('contrato_id', $contract->id)
            ->where('impresora_id', $printer->id)
            ->where('activa', true)
            ->value('alias');

        $contract->printers()->updateExistingPivot($printer->id, [
            'fecha_liberacion' => now(),
            'activa' => false,
        ]);

        $printer->update([
            'estado' => PrinterStatus::EN_ALMACEN,
            'almacen_id' => $warehouseId,
        ]);

        $datosAdicionales = ['contrato_id' => $contract->id, 'almacen_destino' => $warehouseId];
        if ($visitaId) {
            $datosAdicionales['visita_id'] = $visitaId;
        }
        if ($alias !== null) {
            $datosAdicionales['alias'] = $alias;
        }

        PrinterHistory::create([
            'impresora_id' => $printer->id,
            'tipo_evento' => 'LIBERACION_CONTRATO',
            'descripcion' => "Liberada del contrato {$contract->codigo_negocio}",
            'datos_adicionales' => $datosAdicionales,
            'socio_id' => $user->id,
            'fecha' => now(),
        ]);
    }

    /**
     * Renombra el alias de una asignacion ACTIVA. Es un cambio administrativo:
     * no escribe PrinterHistory (el valor historico ya quedo congelado en los
     * eventos de asignacion/liberacion). alias null limpia el alias.
     */
    public function updateAssignmentAlias(Contract $contract, ContractPrinter $assignment, ?string $alias): ContractPrinter
    {
        if ($assignment->contrato_id !== $contract->id) {
            throw new BusinessRuleException('La asignación no pertenece a este contrato');
        }

        if ($assignment->activa !== true) {
            throw new BusinessRuleException('Solo se puede editar el alias de asignaciones activas');
        }

        $alias = $this->normalizarAlias($alias);

        if ($alias !== null) {
            $aliasDuplicado = ContractPrinter::where('contrato_id', $contract->id)
                ->where('alias', $alias)
                ->where('activa', true)
                ->where('id', '!=', $assignment->id)
                ->exists();

            if ($aliasDuplicado) {
                throw new BusinessRuleException("El alias '{$alias}' ya está en uso en una asignación activa de este contrato");
            }
        }

        try {
            $assignment->update(['alias' => $alias]);
        } catch (UniqueConstraintViolationException) {
            throw new BusinessRuleException("El alias '{$alias}' ya está en uso en una asignación activa de este contrato");
        }

        return $assignment;
    }

    private function normalizarAlias(?string $alias): ?string
    {
        $alias = $alias !== null ? trim($alias) : null;

        return $alias === '' ? null : $alias;
    }

    public function calculateEstimatedAmount(Contract $contract, int $pagesConsumed): float
    {
        return $contract->calculateEstimatedAmount($pagesConsumed);
    }
}
