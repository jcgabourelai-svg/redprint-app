<?php

namespace App\Services;

use App\Enums\ArticleType;
use App\Enums\PrinterCondition;
use App\Enums\PrinterStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Article;
use App\Models\Printer;
use App\Models\PrinterHistory;
use App\Models\PrinterModel;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PrinterService
{
    public function __construct(
        private CodeGeneratorService $codeGenerator,
        private InventoryService $inventoryService
    ) {}

    public function create(array $data, User $creator): Printer
    {
        return DB::transaction(function () use ($data, $creator) {
            $data = $this->resolveModelDenorm($data);
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
        return DB::transaction(function () use ($printer, $data) {
            $data = $this->resolveModelDenorm($data);
            $printer->update($data);
            return $printer->fresh();
        });
    }

    private function resolveModelDenorm(array $data): array
    {
        if (array_key_exists('printer_model_id', $data)) {
            $modelId = $data['printer_model_id'];
            if ($modelId) {
                $model = PrinterModel::with('brand')->find($modelId);
                if ($model) {
                    $data['marca'] = $model->brand->nombre;
                    $data['modelo'] = $model->nombre;
                }
            }
        }

        return $data;
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

    /**
     * Actualiza la condición técnica (ortogonal al estado comercial) dejando
     * rastro en el historial: condición previa, nueva, motivo y origen.
     * El origen distingue cambios manuales ('MANUAL') de las transiciones
     * automáticas disparadas por órdenes de mantenimiento ('ORDEN') o por el
     * deshuese ('DESHUESE').
     *
     * No-op cuando la condición no cambia (evita ruido en el historial);
     * la nota y la fecha sí se refrescan en ese caso.
     */
    public function actualizarCondicion(
        Printer $printer,
        PrinterCondition $nueva,
        ?string $nota,
        string $motivo,
        User $user,
        string $origen = 'MANUAL',
    ): Printer {
        $previa = $printer->condicion;

        if ($previa === $nueva) {
            $printer->update([
                'condicion_nota' => $nota,
                'condicion_actualizada_en' => now(),
            ]);

            return $printer->fresh();
        }

        return DB::transaction(function () use ($printer, $nueva, $nota, $motivo, $user, $origen, $previa) {
            $printer->update([
                'condicion' => $nueva,
                'condicion_nota' => $nota,
                'condicion_actualizada_en' => now(),
            ]);

            PrinterHistory::create([
                'impresora_id' => $printer->id,
                'tipo_evento' => 'CONDICION_ACTUALIZADA',
                'descripcion' => "Condición técnica cambiada de " . ($previa?->value ?? 'SIN_CONDICION') . " a {$nueva->value}",
                'datos_adicionales' => [
                    'condicion_previa' => $previa?->value,
                    'condicion_nueva' => $nueva->value,
                    'motivo' => $motivo,
                    'origen' => $origen,
                ],
                'socio_id' => $user->id,
                'fecha' => now(),
            ]);

            return $printer->fresh();
        });
    }

    /**
     * Extracción de pieza de una donante (condición PIEZAS). La pieza entra
     * al inventario por el kardex estándar (InventoryService::registerEntry,
     * lock + movimiento + alerta) con referencia DESHUESE hacia la impresora.
     *
     * $data: articulo_id (existente) o nombre_nuevo+tipo_articulo, cantidad,
     * costo_unitario (default 0) y num_parte opcionales.
     */
    public function extraerPieza(Printer $printer, array $data, User $user): Article
    {
        if ($printer->condicion !== PrinterCondition::PIEZAS) {
            throw new BusinessRuleException(
                'Solo se pueden extraer piezas de impresoras marcadas como donantes (condición PIEZAS)'
            );
        }

        return DB::transaction(function () use ($printer, $data, $user) {
            $cantidad = (int) $data['cantidad'];
            $costoUnitario = isset($data['costo_unitario']) ? (float) $data['costo_unitario'] : 0.0;

            if (!empty($data['articulo_id'])) {
                $article = Article::findOrFail($data['articulo_id']);
            } else {
                $article = Article::create([
                    'tipo_articulo' => ArticleType::from($data['tipo_articulo']),
                    'subtipo' => 'Pieza de deshuese',
                    'nombre' => $data['nombre_nuevo'],
                    'modelo_sku' => $data['num_parte'] ?? null,
                    'stock_actual' => 0,
                    'umbral_reposicion' => 0,
                    'costo_unitario' => $costoUnitario,
                    'activo' => true,
                    'fecha_creacion' => now(),
                ]);
            }

            $this->inventoryService->registerEntry(
                $article,
                $cantidad,
                $user,
                'DESHUESE',
                $printer->id,
                "Pieza extraída de impresora #{$printer->id}"
            );

            $articulo = "{$article->nombre} x{$cantidad}";
            $printer->update([
                'condicion_nota' => trim(($printer->condicion_nota ? $printer->condicion_nota . "\n" : '') . "[PIEZA EXTRAÍDA] {$articulo}"),
                'condicion_actualizada_en' => now(),
            ]);

            PrinterHistory::create([
                'impresora_id' => $printer->id,
                'tipo_evento' => 'PIEZA_EXTRAIDA',
                'descripcion' => "Pieza extraída para inventario: {$articulo}",
                'datos_adicionales' => [
                    'articulo_id' => $article->id,
                    'cantidad' => $cantidad,
                    'costo_unitario' => $costoUnitario,
                ],
                'socio_id' => $user->id,
                'fecha' => now(),
            ]);

            return $article->fresh();
        });
    }

    public function forceDelete(Printer $printer): void
    {
        if ($printer->estado === PrinterStatus::RENTADA) {
            throw new BusinessRuleException('No se puede eliminar una impresora rentada');
        }

        if (!$printer->esEliminable()) {
            throw new BusinessRuleException('No se puede eliminar la impresora porque tiene lecturas, gastos, contratos, mantenimientos o facturas asociadas. Dale de baja en su lugar.');
        }

        DB::transaction(function () use ($printer) {
            $printer->history()->delete();
            $printer->delete();
        });
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
