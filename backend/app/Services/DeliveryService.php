<?php

namespace App\Services;

use App\Enums\VisitStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Article;
use App\Models\ArticleDelivery;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Support\Facades\DB;

class DeliveryService
{
    public function __construct(
        private InventoryService $inventoryService
    ) {}

    /**
     * Registra la entrega de un articulo (toner/consumible) durante una visita.
     * El tipo_visita es el motivo principal de la visita, no una restriccion:
     * se pueden entregar insumos en cualquier visita editable. Descuenta stock
     * con InventoryService (lock + transaccion + alertas) y guarda snapshot de
     * costos para facturacion futura.
     */
    public function deliver(Visit $visit, int $articleId, int $cantidad, User $socio): ArticleDelivery
    {
        if (! in_array($visit->estado, [VisitStatus::PENDIENTE, VisitStatus::REPROGRAMADA], true)) {
            throw new BusinessRuleException('Solo se pueden entregar insumos en visitas pendientes o reprogramadas');
        }

        if ($cantidad < 1) {
            throw new BusinessRuleException('La cantidad a entregar debe ser al menos 1');
        }

        $article = Article::findOrFail($articleId);

        if (! $article->activo) {
            throw new BusinessRuleException("El articulo '{$article->nombre}' no está activo");
        }

        return DB::transaction(function () use ($visit, $article, $cantidad, $socio) {
            $delivery = ArticleDelivery::create([
                'articulo_id' => $article->id,
                'visita_id' => $visit->id,
                'contrato_id' => $visit->contrato_id,
                'cliente_id' => $visit->cliente_id,
                'cantidad' => $cantidad,
                'costo_unitario' => $article->costo_unitario,
                'subtotal' => $cantidad * (float) $article->costo_unitario,
                'socio_id' => $socio->id,
                'fecha_creacion' => now(),
            ]);

            $this->inventoryService->registerExit(
                $article,
                $cantidad,
                $socio,
                'ARTICLE_DELIVERY',
                $delivery->id,
                "Entrega en visita #{$visit->id}"
            );

            return $delivery;
        });
    }
}
