<?php

namespace App\Services;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Contract;
use App\Models\Printer;
use App\Models\PrinterHistory;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ContractService
{
    public function __construct(
        private CodeGeneratorService $codeGenerator
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
                $this->assignPrinter($contract, $printerData['id'], $printerData['lectura_inicial'] ?? 0, $creator);
            }

            return $contract->fresh(['client', 'printers']);
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

            foreach ($contract->activePrinters as $printer) {
                $this->releasePrinter($contract, $printer, $warehouseId, $user);
            }

            return $contract->fresh(['client', 'printers']);
        });
    }

    public function assignPrinter(Contract $contract, int $printerId, int $initialReading, User $user): void
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

        $contract->printers()->attach($printerId, [
            'fecha_asignacion' => now(),
            'lectura_inicial' => $initialReading,
            'activa' => true,
        ]);

        $printer->update([
            'estado' => PrinterStatus::RENTADA,
            'almacen_id' => null,
        ]);

        PrinterHistory::create([
            'impresora_id' => $printer->id,
            'tipo_evento' => 'ASIGNACION_CONTRATO',
            'descripcion' => "Asignada al contrato {$contract->codigo_negocio}",
            'datos_adicionales' => ['contrato_id' => $contract->id],
            'socio_id' => $user->id,
            'fecha' => now(),
        ]);
    }

    public function releasePrinter(Contract $contract, Printer $printer, int $warehouseId, User $user): void
    {
        $contract->printers()->updateExistingPivot($printer->id, [
            'fecha_liberacion' => now(),
            'activa' => false,
        ]);

        $printer->update([
            'estado' => PrinterStatus::EN_ALMACEN,
            'almacen_id' => $warehouseId,
        ]);

        PrinterHistory::create([
            'impresora_id' => $printer->id,
            'tipo_evento' => 'LIBERACION_CONTRATO',
            'descripcion' => "Liberada del contrato {$contract->codigo_negocio}",
            'datos_adicionales' => ['contrato_id' => $contract->id, 'almacen_destino' => $warehouseId],
            'socio_id' => $user->id,
            'fecha' => now(),
        ]);
    }

    public function calculateEstimatedAmount(Contract $contract, int $pagesConsumed): float
    {
        return $contract->calculateEstimatedAmount($pagesConsumed);
    }
}
