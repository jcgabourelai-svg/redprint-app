<?php

namespace App\Services;

use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use App\Enums\PrinterStatus;
use App\Enums\ProblemSeverity;
use App\Exceptions\BusinessRuleException;
use App\Models\Article;
use App\Models\ArticleUsed;
use App\Models\ContractPrinter;
use App\Models\MaintenanceOrder;
use App\Models\Notification;
use App\Models\PrinterHistory;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class MaintenanceService
{
    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function create(array $data, User $creator): MaintenanceOrder
    {
        return DB::transaction(function () use ($data, $creator) {
            $data['socio_id'] = $creator->id;
            $data['estado'] = MaintenanceStatus::PROGRAMADA;
            $data['fecha_creacion'] = now();
            $data['costo_total'] = 0;

            $order = MaintenanceOrder::create($data);

            if ($order->tipo_mantto === MaintenanceType::CORRECTIVO) {
                $printer = $order->printer;

                $order->update(['estado_anterior_impresora' => $printer->estado->value]);

                $printer->update(['estado' => PrinterStatus::EN_MANTENIMIENTO]);

                PrinterHistory::create([
                    'impresora_id' => $printer->id,
                    'tipo_evento' => 'MANTENIMIENTO_INICIO',
                    'descripcion' => "Inicio mantenimiento correctivo - Orden #{$order->id}",
                    'datos_adicionales' => ['orden_mantto_id' => $order->id],
                    'socio_id' => $creator->id,
                    'fecha' => now(),
                ]);
            }

            if ($order->severidad === ProblemSeverity::CRITICA) {
                $this->notifyCriticalFailure($order);
            }

            return $order->fresh(['printer', 'visit']);
        });
    }

    public function addArticle(MaintenanceOrder $order, int $articleId, int $quantity, User $user): ArticleUsed
    {
        if ($order->estado !== MaintenanceStatus::PROGRAMADA) {
            throw new BusinessRuleException('Solo se pueden agregar articulos a ordenes programadas');
        }

        $article = Article::findOrFail($articleId);

        // Validación preventiva (UX): cuenta las filas ya agregadas del mismo
        // artículo en la orden. La fuente de verdad sigue siendo el lock de
        // registerExit al completar.
        $cantidadEnOrden = (int) ArticleUsed::where('orden_mantto_id', $order->id)
            ->where('articulo_id', $articleId)
            ->sum('cantidad');

        $solicitado = $cantidadEnOrden + $quantity;

        if ($solicitado > $article->stock_actual) {
            throw new BusinessRuleException(
                "Stock insuficiente: disponible {$article->stock_actual}, solicitado {$solicitado}"
            );
        }

        return ArticleUsed::create([
            'articulo_id' => $articleId,
            'orden_mantto_id' => $order->id,
            'cantidad' => $quantity,
            'costo_unitario' => $article->costo_unitario,
            'subtotal' => $quantity * (float) $article->costo_unitario,
        ]);
    }

    public function removeArticle(MaintenanceOrder $order, int $articleUsedId): void
    {
        if ($order->estado !== MaintenanceStatus::PROGRAMADA) {
            throw new BusinessRuleException('Solo se pueden remover articulos de ordenes programadas');
        }

        $articleUsed = ArticleUsed::where('orden_mantto_id', $order->id)
            ->findOrFail($articleUsedId);

        $articleUsed->delete();
    }

    public function complete(MaintenanceOrder $order, array $data, User $user): MaintenanceOrder
    {
        if ($order->estado !== MaintenanceStatus::PROGRAMADA) {
            throw new BusinessRuleException('Solo se pueden completar ordenes programadas');
        }

        return DB::transaction(function () use ($order, $data, $user) {
            $articlesUsed = $order->articlesUsed()->with('article')->get();
            $articlesCost = $articlesUsed->sum('subtotal');

            $costoManoObra = $data['costo_mano_obra'] ?? $order->costo_mano_obra;
            $costoTotal = (float) $costoManoObra + $articlesCost;

            $order->update([
                'estado' => MaintenanceStatus::COMPLETADA,
                'trabajo_realizado' => $data['trabajo_realizado'] ?? $order->trabajo_realizado,
                'costo_mano_obra' => $costoManoObra,
                'costo_total' => $costoTotal,
                'fecha_completado' => now(),
            ]);

            foreach ($articlesUsed as $articleUsed) {
                $this->inventoryService->registerExit(
                    $articleUsed->article,
                    $articleUsed->cantidad,
                    $user,
                    'MaintenanceOrder',
                    $order->id,
                    "Salida por orden de mantenimiento #{$order->id}"
                );
            }

            // Contador al terminar el taller: las páginas de pruebas quedan
            // registradas en la serie para que la próxima lectura inicial del
            // re-ingreso no las facture al cliente.
            if (isset($data['contador_impresora']) && $data['contador_impresora'] !== null) {
                $this->actualizarContadorImpresora($order, (int) $data['contador_impresora'], $user);
            }

            if ($order->tipo_mantto === MaintenanceType::CORRECTIVO) {
                $this->restorePrinterState(
                    $order,
                    $user,
                    'MANTENIMIENTO_FIN',
                    "Mantenimiento correctivo completado - Orden #{$order->id}",
                    ['costo_total' => $costoTotal],
                );
            } else {
                PrinterHistory::create([
                    'impresora_id' => $order->printer->id,
                    'tipo_evento' => 'MANTENIMIENTO_PREVENTIVO',
                    'descripcion' => "Mantenimiento preventivo completado - Orden #{$order->id}",
                    'datos_adicionales' => [
                        'orden_mantto_id' => $order->id,
                        'costo_total' => $costoTotal,
                    ],
                    'socio_id' => $user->id,
                    'fecha' => now(),
                ]);
            }

            return $order->fresh(['printer', 'articlesUsed.article']);
        });
    }

    public function cancel(MaintenanceOrder $order, User $user): MaintenanceOrder
    {
        if ($order->estado !== MaintenanceStatus::PROGRAMADA) {
            throw new BusinessRuleException('Solo se pueden cancelar ordenes programadas');
        }

        return DB::transaction(function () use ($order, $user) {
            $order->update(['estado' => MaintenanceStatus::CANCELADA]);

            $order->articlesUsed()->delete();

            $this->restorePrinterState(
                $order,
                $user,
                'MANTENIMIENTO_CANCELADO',
                "Mantenimiento cancelado - Orden #{$order->id}",
            );

            return $order->fresh();
        });
    }

    public function delete(MaintenanceOrder $order, User $user): MaintenanceOrder
    {
        if (!in_array($order->estado, [MaintenanceStatus::PROGRAMADA, MaintenanceStatus::CANCELADA], true)) {
            throw new BusinessRuleException('Solo se pueden eliminar ordenes programadas o canceladas');
        }

        return DB::transaction(function () use ($order, $user) {
            if ($order->estado === MaintenanceStatus::PROGRAMADA) {
                $order->articlesUsed()->delete();

                $this->restorePrinterState(
                    $order,
                    $user,
                    'MANTENIMIENTO_ELIMINADO',
                    "Orden de mantenimiento eliminada - Orden #{$order->id}",
                );
            }

            $order->expenses()->update(['orden_mantto_id' => null]);

            $order->delete();

            return $order;
        });
    }

    /**
     * Sincroniza printers.contador_actual desde el taller. Solo admite
     * valores no decrecientes: un contador menor al registrado indica error
     * de captura (los contadores físicos no retroceden en taller).
     */
    private function actualizarContadorImpresora(MaintenanceOrder $order, int $contador, User $user): void
    {
        $printer = $order->printer;

        if ($contador < (int) $printer->contador_actual) {
            throw new BusinessRuleException(
                "El contador al terminar ({$contador}) es menor que el contador registrado de la impresora ({$printer->contador_actual}). Verifica la captura."
            );
        }

        if ($contador === (int) $printer->contador_actual) {
            return;
        }

        $printer->update(['contador_actual' => $contador]);

        PrinterHistory::create([
            'impresora_id' => $printer->id,
            'tipo_evento' => 'ACTUALIZACION_CONTADOR',
            'descripcion' => "Contador actualizado desde taller - Orden #{$order->id}",
            'datos_adicionales' => [
                'origen' => 'MANTENIMIENTO',
                'orden_id' => $order->id,
                'contador' => $contador,
            ],
            'socio_id' => $user->id,
            'fecha' => now(),
        ]);
    }

    /**
     * Restaura la impresora al concluir una orden correctiva, pero es
     * consciente de lo que pasó mientras la orden estaba abierta:
     *
     * 1. Si la impresora ya no está EN_MANTENIMIENTO (alguien la liberó, la
     *    dio de baja o la reasignó), no se toca el estado actual: se conserva
     *    y se deja constancia de la omisión en el historial.
     * 2. Si el estado anterior era RENTADA pero ya no existe una asignación
     *    activa (el contrato terminó mientras se reparaba), no se puede volver
     *    a RENTADA sin contrato: la impresora regresa a EN_ALMACEN conservando
     *    su almacén vigente.
     * 3. En cualquier otro caso se restaura el estado anterior tal cual.
     */
    private function restorePrinterState(
        MaintenanceOrder $order,
        User $user,
        string $evento,
        string $descripcion,
        array $extraDatos = [],
    ): void {
        if ($order->tipo_mantto !== MaintenanceType::CORRECTIVO) {
            return;
        }

        $printer = $order->printer->fresh() ?? $order->printer;

        $previousStatus = $order->estado_anterior_impresora
            ? PrinterStatus::from($order->estado_anterior_impresora)
            : PrinterStatus::EN_ALMACEN;

        $datosBase = array_merge(['orden_mantto_id' => $order->id], $extraDatos);

        // (1) Alguien movió la impresora después del inicio del mantenimiento.
        if ($printer->estado !== PrinterStatus::EN_MANTENIMIENTO) {
            PrinterHistory::create([
                'impresora_id' => $printer->id,
                'tipo_evento' => $evento,
                'descripcion' => $descripcion,
                'datos_adicionales' => array_merge($datosBase, [
                    'restauracion_omitida' => true,
                    'estado_conservado' => $printer->estado->value,
                ]),
                'socio_id' => $user->id,
                'fecha' => now(),
            ]);

            return;
        }

        // (2) RENTADA sin contrato activo: regresa al almacén, nunca a renta huérfana.
        if (
            $previousStatus === PrinterStatus::RENTADA
            && !ContractPrinter::where('impresora_id', $printer->id)->where('activa', true)->exists()
        ) {
            $datosRestauracion = array_merge($datosBase, ['estado_restaurado' => PrinterStatus::EN_ALMACEN->value]);

            if ($printer->almacen_id === null) {
                $datosRestauracion['almacen_id_null'] = true;
            }

            $printer->update(['estado' => PrinterStatus::EN_ALMACEN]);

            PrinterHistory::create([
                'impresora_id' => $printer->id,
                'tipo_evento' => $evento,
                'descripcion' => $descripcion,
                'datos_adicionales' => $datosRestauracion,
                'socio_id' => $user->id,
                'fecha' => now(),
            ]);

            return;
        }

        // (3) Restauración normal al estado anterior.
        $printer->update(['estado' => $previousStatus]);

        PrinterHistory::create([
            'impresora_id' => $printer->id,
            'tipo_evento' => $evento,
            'descripcion' => $descripcion,
            'datos_adicionales' => array_merge($datosBase, [
                'estado_restaurado' => $previousStatus->value,
            ]),
            'socio_id' => $user->id,
            'fecha' => now(),
        ]);
    }

    public function calculateTotalCost(MaintenanceOrder $order): float
    {
        $articlesCost = $order->articlesUsed->sum('subtotal');
        return (float) $order->costo_mano_obra + $articlesCost;
    }

    public function update(MaintenanceOrder $order, array $data): MaintenanceOrder
    {
        if ($order->estado !== MaintenanceStatus::PROGRAMADA) {
            throw new BusinessRuleException('Solo se pueden editar órdenes programadas');
        }

        $order->update($data);

        $order->costo_total = $this->calculateTotalCost($order);
        $order->save();

        return $order->fresh(['printer', 'articlesUsed.article']);
    }

    public function registerPrinterExpense(array $data, User $creator): \App\Models\PrinterExpense
    {
        $data['socio_id'] = $creator->id;
        $data['fecha_creacion'] = now();

        return \App\Models\PrinterExpense::create($data);
    }

    /**
     * Notifica una falla CRÍTICA a los usuarios activos con permiso de
     * mantenimiento (rol sistema o permiso explícito por pivot). Una
     * notificación por usuario por orden.
     */
    private function notifyCriticalFailure(MaintenanceOrder $order): void
    {
        $printer = $order->printer;
        $mensaje = "Impresora {$printer->marca} {$printer->modelo} (#{$printer->id}): {$order->desc_problema}";

        $usuarios = User::withPermission('inventario.mantenimiento')->get();

        foreach ($usuarios as $usuario) {
            Notification::create([
                'usuario_id' => $usuario->id,
                'tipo' => 'MAINTENANCE_CRITICAL',
                'titulo' => 'Falla crítica reportada',
                'mensaje' => $mensaje,
                'leida' => false,
                'referencia_tipo' => 'MaintenanceOrder',
                'referencia_id' => $order->id,
                'fecha' => now(),
            ]);
        }
    }
}
