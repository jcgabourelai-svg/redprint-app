<?php

namespace App\Services;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Exceptions\BusinessRuleException;
use App\Models\Contract;
use App\Models\ContractPrinter;
use App\Models\ContractPrinterPlan;
use App\Models\Printer;
use App\Models\PrinterHistory;
use App\Models\User;
use App\Models\Visit;
use App\Support\PrinterColorPalette;
use Carbon\Carbon;
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

            $planRows = $data['plan_impresoras'] ?? [];
            unset($data['plan_impresoras']);

            $programarInstalacion = filter_var($data['programar_visita_instalacion'] ?? true, FILTER_VALIDATE_BOOLEAN);
            $fechaInstalacion = $data['fecha_visita_instalacion'] ?? null;
            unset($data['programar_visita_instalacion'], $data['fecha_visita_instalacion']);

            $contract = Contract::create($data);

            foreach ($planRows as $row) {
                $this->crearFilaPlan($contract, $row);
            }

            foreach ($printerIds as $printerData) {
                $this->assignPrinter(
                    $contract,
                    $printerData['id'],
                    $printerData['lectura_inicial'] ?? null,
                    $creator,
                    null,
                    $printerData['alias'] ?? null
                );
            }

            $contract = $contract->fresh(['client', 'printers', 'planImpresoras.printerModel.brand']);
            $contract->loadCount('activePrinters');

            // Genera la 1ra visita recurrente (rolling) sin esperar al cron,
            // dentro de la misma transaccion para garantizar atomicidad.
            $this->visitScheduler->generateNextCycle($contract, $creator->id);

            $totalPlan = (int) $contract->planImpresoras->sum('cantidad');
            $pendientes = max(0, $totalPlan - (int) $contract->active_printers_count);

            if ($pendientes > 0 && $programarInstalacion && !empty($fechaInstalacion)) {
                Visit::create([
                    'cliente_id' => $contract->cliente_id,
                    'contrato_id' => $contract->id,
                    'tipo_visita' => VisitType::INSTALACION,
                    'fecha_programada' => Carbon::parse($fechaInstalacion)->startOfDay(),
                    'socio_id' => $creator->id,
                    'estado' => VisitStatus::PENDIENTE,
                    'creado_por' => $creator->id,
                    'fecha_creacion' => now(),
                    'notas' => 'Instalación inicial: vincular series del plan desde la app móvil.',
                ]);
            }

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

    /**
     * Reemplaza por completo el plan de modelos del contrato (replace-all).
     * Solo en contratos ACTIVOS: el plan es intención comercial y se ajusta
     * mientras el contrato vive; las asignaciones físicas no se tocan.
     */
    public function updatePlan(Contract $contract, array $rows): Contract
    {
        if ($contract->estado !== ContractStatus::ACTIVO) {
            throw new BusinessRuleException('Solo se puede editar el plan de contratos activos');
        }

        return DB::transaction(function () use ($contract, $rows) {
            $contract->planImpresoras()->delete();

            foreach ($rows as $row) {
                $this->crearFilaPlan($contract, $row);
            }

            $contract = $contract->fresh(['client', 'printers', 'planImpresoras.printerModel.brand']);
            $contract->loadCount('activePrinters');

            return $contract;
        });
    }

    private function crearFilaPlan(Contract $contract, array $row): ContractPrinterPlan
    {
        try {
            return $contract->planImpresoras()->create([
                'printer_model_id' => $row['modelo_id'],
                'cantidad' => (int) $row['cantidad'],
            ]);
        } catch (UniqueConstraintViolationException) {
            // Backstop: el unique (contrato_id, printer_model_id) atrapa
            // duplicados que escapen a la validación (p. ej. concurrencia).
            throw new BusinessRuleException('No se puede repetir el mismo modelo de impresora en el plan');
        }
    }

    public function assignPrinter(Contract $contract, int $printerId, ?int $initialReading, User $user, ?int $visitaId = null, ?string $alias = null, ?string $color = null): void
    {
        $printer = Printer::findOrFail($printerId);

        // D-D: sin lectura explícita, la línea base es el contador físico de
        // la serie (nunca 0: no se cobra el histórico previo a la instalación).
        $initialReading ??= (int) $printer->contador_actual;

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
        $color = $this->resolverColor($contract, $color);

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
                'color' => $color,
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
        if ($color !== null) {
            $datosAdicionales['color'] = $color;
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
        $filaActiva = ContractPrinter::where('contrato_id', $contract->id)
            ->where('impresora_id', $printer->id)
            ->where('activa', true)
            ->first(['alias', 'color']);

        $alias = $filaActiva?->alias;
        $color = $filaActiva?->color;

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
        if ($color !== null) {
            $datosAdicionales['color'] = $color;
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

    /**
     * Herencia best-effort: usa el color pedido solo si es una key valida de
     * la paleta y no esta en uso por otra asignacion ACTIVA del contrato
     * (el reenvio desde movil jamas bloquea una instalacion en campo). En
     * cualquier otro caso asigna el primer color libre; con mas de 8 activas
     * se reutiliza por modulo. El color es pista visual secundaria: el texto
     * del alias siempre esta presente.
     */
    private function resolverColor(Contract $contract, ?string $color): string
    {
        $usados = ContractPrinter::where('contrato_id', $contract->id)
            ->where('activa', true)
            ->pluck('color')
            ->filter()
            ->values();

        if ($color !== null
            && in_array($color, PrinterColorPalette::KEYS, true)
            && ! $usados->contains($color)) {
            return $color;
        }

        foreach (PrinterColorPalette::KEYS as $key) {
            if (! $usados->contains($key)) {
                return $key;
            }
        }

        return PrinterColorPalette::KEYS[$usados->count() % count(PrinterColorPalette::KEYS)];
    }

    public function calculateEstimatedAmount(Contract $contract, int $pagesConsumed): float
    {
        return $contract->calculateEstimatedAmount($pagesConsumed);
    }
}
