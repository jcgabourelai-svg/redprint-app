<?php

namespace App\Services;

use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use App\Enums\PrinterStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\ArticleUsed;
use App\Models\MaintenanceOrder;
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
                $data['estado_anterior_impresora'] = $printer->estado->value;

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

            return $order->fresh(['printer', 'visit']);
        });
    }

    public function addArticle(MaintenanceOrder $order, int $articleId, int $quantity, User $user): ArticleUsed
    {
        if ($order->estado !== MaintenanceStatus::PROGRAMADA) {
            throw new BusinessRuleException('Solo se pueden agregar articulos a ordenes programadas');
        }

        $article = \App\Models\Article::findOrFail($articleId);

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

        $previousStatus = $order->estado_anterior_impresora
            ? PrinterStatus::from($order->estado_anterior_impresora)
            : PrinterStatus::EN_ALMACEN;

        $order->printer->update(['estado' => $previousStatus]);

        PrinterHistory::create([
            'impresora_id' => $order->printer->id,
            'tipo_evento' => $evento,
            'descripcion' => $descripcion,
            'datos_adicionales' => array_merge(
                ['orden_mantto_id' => $order->id, 'estado_restaurado' => $previousStatus->value],
                $extraDatos,
            ),
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

    public function getPrinterMaintenanceHistory(int $printerId, int $perPage = 20)
    {
        return MaintenanceOrder::where('impresora_id', $printerId)
            ->with(['socio', 'articlesUsed.article'])
            ->orderBy('fecha', 'desc')
            ->paginate($perPage);
    }

    public function generateMaintenanceReport(): array
    {
        $completedOrders = MaintenanceOrder::where('estado', MaintenanceStatus::COMPLETADA)->get();

        return [
            'total_ordenes' => $completedOrders->count(),
            'costo_total' => $completedOrders->sum('costo_total'),
            'preventivas' => $completedOrders->where('tipo_mantto', MaintenanceType::PREVENTIVO)->count(),
            'correctivas' => $completedOrders->where('tipo_mantto', MaintenanceType::CORRECTIVO)->count(),
            'costo_promedio' => $completedOrders->count() > 0
                ? $completedOrders->sum('costo_total') / $completedOrders->count()
                : 0,
        ];
    }
}
