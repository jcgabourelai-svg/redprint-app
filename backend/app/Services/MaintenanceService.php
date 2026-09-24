<?php

namespace App\Services;

use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use App\Enums\PrinterCondition;
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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class MaintenanceService
{
    public function __construct(
        private InventoryService $inventoryService,
        private PrinterService $printerService,
        private MaintenancePlanService $maintenancePlanService
    ) {}

    /**
     * $sacarDeCirculacion (D24): desplaza la impresora a EN_MANTENIMIENTO
     * aunque la orden sea PREVENTIVA (orden nacida de un retiro de contrato).
     * El correctivo siempre saca la impresora (falla en sitio); las
     * preventivas de web (equipo rentado, servicio en visita) NO cambian el
     * estado de la impresora.
     */
    public function create(array $data, User $creator, bool $sacarDeCirculacion = false): MaintenanceOrder
    {
        $order = DB::transaction(function () use ($data, $creator, $sacarDeCirculacion) {
            $data['socio_id'] = $creator->id;
            $data['estado'] = MaintenanceStatus::PROGRAMADA;
            $data['fecha_creacion'] = now();
            $data['costo_total'] = 0;

            $order = MaintenanceOrder::create($data);

            if ($order->tipo_mantto === MaintenanceType::CORRECTIVO || $sacarDeCirculacion) {
                $printer = $order->printer;

                $order->update(['estado_anterior_impresora' => $printer->estado->value]);

                $printer->update(['estado' => PrinterStatus::EN_MANTENIMIENTO]);

                PrinterHistory::create([
                    'impresora_id' => $printer->id,
                    'tipo_evento' => 'MANTENIMIENTO_INICIO',
                    'descripcion' => sprintf(
                        'Inicio mantenimiento %s - Orden #%d',
                        $order->tipo_mantto === MaintenanceType::CORRECTIVO ? 'correctivo' : 'preventivo',
                        $order->id
                    ),
                    'datos_adicionales' => ['orden_mantto_id' => $order->id],
                    'socio_id' => $creator->id,
                    'fecha' => now(),
                ]);
            }

            // Condición técnica (F2): un correctivo abre paso a NO_OPERATIVA
            // (severidad ALTA/CRITICA) o REQUIERE_ATENCION (BAJA/MEDIA/null).
            // Las donantes de piezas nunca se tocan automáticamente.
            if ($order->tipo_mantto === MaintenanceType::CORRECTIVO) {
                $printer = $printer ?? $order->printer;

                if ($printer->condicion !== PrinterCondition::PIEZAS) {
                    $nueva = in_array($order->severidad, [ProblemSeverity::ALTA, ProblemSeverity::CRITICA], true)
                        ? PrinterCondition::NO_OPERATIVA
                        : PrinterCondition::REQUIERE_ATENCION;

                    if ($printer->condicion !== $nueva) {
                        $this->printerService->actualizarCondicion(
                            $printer,
                            $nueva,
                            null,
                            "Falla reportada en orden correctiva #{$order->id}",
                            $creator,
                            'ORDEN'
                        );
                    }
                }
            }

            if ($order->severidad === ProblemSeverity::CRITICA) {
                $this->notifyCriticalFailure($order);
            }

            return $order->fresh(['printer', 'visit']);
        });

        Cache::forget('taller.dashboard');

        return $order;
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
            // D3/F4: el origen se congela al agregar la pieza; reclasificar
            // el artículo después no altera el histórico de la orden.
            'origen_snapshot' => $article->origen?->value,
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

        $order = DB::transaction(function () use ($order, $data, $user) {
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

            // El evento del servicio preventivo SIEMPRE se escribe, haya o no
            // habido desplazamiento a taller (histórico por orden).
            if ($order->tipo_mantto === MaintenanceType::PREVENTIVO) {
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

            // D24: la restauración se keyed por "¿desplazamos la impresora?"
            // (estado_anterior guardado al iniciar), no por el tipo de orden.
            // La preventiva nacida de un retiro también vuelve del taller.
            if ($order->estado_anterior_impresora !== null) {
                $esPreventivo = $order->tipo_mantto === MaintenanceType::PREVENTIVO;

                $this->restorePrinterState(
                    $order,
                    $user,
                    $esPreventivo ? 'MANTENIMIENTO_PREVENTIVO_FIN' : 'MANTENIMIENTO_FIN',
                    $esPreventivo
                        ? "Fin mantenimiento preventivo - Orden #{$order->id}"
                        : "Mantenimiento correctivo completado - Orden #{$order->id}",
                    ['costo_total' => $costoTotal],
                );
            }

            // Condición técnica (F2): DESPUÉS de restorePrinterState, cuando
            // el estado comercial final ya es conocido. El deshuese exige
            // almacén; cualquier otra completada devuelve OPERATIVA. Las
            // donantes de piezas (PIEZAS) nunca cambian automáticamente.
            $printer = $order->printer->fresh() ?? $order->printer;

            if (!empty($data['queda_para_piezas'])) {
                if ($printer->estado !== PrinterStatus::EN_ALMACEN) {
                    throw new BusinessRuleException(
                        'No se puede marcar "queda para piezas": el deshuese solo procede con la impresora en almacén (quedó como ' . $printer->estado->value . ').'
                    );
                }

                if ($printer->condicion !== PrinterCondition::PIEZAS) {
                    $this->printerService->actualizarCondicion(
                        $printer,
                        PrinterCondition::PIEZAS,
                        $order->trabajo_realizado,
                        "Deshuese al completar orden #{$order->id}",
                        $user,
                        'ORDEN'
                    );
                }
            } elseif ($printer->condicion !== PrinterCondition::PIEZAS
                && $printer->condicion !== PrinterCondition::OPERATIVA) {
                $this->printerService->actualizarCondicion(
                    $printer,
                    PrinterCondition::OPERATIVA,
                    null,
                    "Servicio completado (orden #{$order->id})",
                    $user,
                    'ORDEN'
                );
            }

            // F5: recálculo del plan preventivo en la misma transacción
            // (actualiza ultimo_*/proximo_* del plan efectivo).
            $this->maintenancePlanService->recalcularTrasCompletar($order);

            return $order->fresh(['printer', 'articlesUsed.article']);
        });

        Cache::forget('taller.dashboard');

        return $order;
    }

    public function cancel(MaintenanceOrder $order, User $user): MaintenanceOrder
    {
        if ($order->estado !== MaintenanceStatus::PROGRAMADA) {
            throw new BusinessRuleException('Solo se pueden cancelar ordenes programadas');
        }

        $order = DB::transaction(function () use ($order, $user) {
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

        Cache::forget('taller.dashboard');

        return $order;
    }

    public function delete(MaintenanceOrder $order, User $user): MaintenanceOrder
    {
        if (!in_array($order->estado, [MaintenanceStatus::PROGRAMADA, MaintenanceStatus::CANCELADA], true)) {
            throw new BusinessRuleException('Solo se pueden eliminar ordenes programadas o canceladas');
        }

        $order = DB::transaction(function () use ($order, $user) {
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

        Cache::forget('taller.dashboard');

        return $order;
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
     * Restaura la impresora al concluir una orden que la sacó de circulación
     * (correctiva, o preventiva nacida de un retiro de contrato), pero es
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
     *
     * D24: la condición de entrada es `estado_anterior_impresora` (¿la orden
     * desplazó a la impresora?), NO el tipo de orden. Órdenes preventivas sin
     * estado guardado (servicio en visita, equipo rentado) no restauran nada.
     */
    private function restorePrinterState(
        MaintenanceOrder $order,
        User $user,
        string $evento,
        string $descripcion,
        array $extraDatos = [],
    ): void {
        if ($order->estado_anterior_impresora === null) {
            return;
        }

        $printer = $order->printer->fresh() ?? $order->printer;

        $previousStatus = PrinterStatus::from($order->estado_anterior_impresora);

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

        Cache::forget('taller.dashboard');

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
