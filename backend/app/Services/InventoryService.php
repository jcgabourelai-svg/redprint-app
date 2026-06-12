<?php

namespace App\Services;

use App\Enums\MovementType;
use App\Exceptions\BusinessRuleException;
use App\Models\Article;
use App\Models\InventoryMovement;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    public function registerEntry(Article $article, int $quantity, User $socio, ?string $referenceType = null, ?int $referenceId = null, ?string $justification = null): InventoryMovement
    {
        return DB::transaction(function () use ($article, $quantity, $socio, $referenceType, $referenceId, $justification) {
            $article = Article::lockForUpdate()->find($article->id);

            $stockAnterior = $article->stock_actual;
            $stockPosterior = $stockAnterior + $quantity;

            $movement = InventoryMovement::create([
                'articulo_id' => $article->id,
                'tipo_movimiento' => MovementType::ENTRADA,
                'cantidad' => $quantity,
                'stock_anterior' => $stockAnterior,
                'stock_posterior' => $stockPosterior,
                'referencia_tipo' => $referenceType,
                'referencia_id' => $referenceId,
                'justificacion' => $justification,
                'fecha' => now(),
                'socio_id' => $socio->id,
                'fecha_creacion' => now(),
            ]);

            $article->update(['stock_actual' => $stockPosterior]);

            $this->checkReorderAlert($article);

            return $movement;
        });
    }

    public function registerExit(Article $article, int $quantity, User $socio, ?string $referenceType = null, ?int $referenceId = null, ?string $justificacion = null): InventoryMovement
    {
        return DB::transaction(function () use ($article, $quantity, $socio, $referenceType, $referenceId, $justificacion) {
            $article = Article::lockForUpdate()->find($article->id);

            if ($article->stock_actual < $quantity) {
                throw new BusinessRuleException("Stock insuficiente para {$article->nombre}. Stock actual: {$article->stock_actual}, solicitado: {$quantity}");
            }

            $stockAnterior = $article->stock_actual;
            $stockPosterior = $stockAnterior - $quantity;

            $movement = InventoryMovement::create([
                'articulo_id' => $article->id,
                'tipo_movimiento' => MovementType::SALIDA,
                'cantidad' => $quantity,
                'stock_anterior' => $stockAnterior,
                'stock_posterior' => $stockPosterior,
                'referencia_tipo' => $referenceType,
                'referencia_id' => $referenceId,
                'justificacion' => $justificacion,
                'fecha' => now(),
                'socio_id' => $socio->id,
                'fecha_creacion' => now(),
            ]);

            $article->update(['stock_actual' => $stockPosterior]);

            $this->checkReorderAlert($article);

            return $movement;
        });
    }

    public function registerAdjustment(Article $article, int $newStock, User $socio, string $justificacion): InventoryMovement
    {
        return DB::transaction(function () use ($article, $newStock, $socio, $justificacion) {
            $article = Article::lockForUpdate()->find($article->id);

            $stockAnterior = $article->stock_actual;
            $cantidad = abs($newStock - $stockAnterior);

            $movement = InventoryMovement::create([
                'articulo_id' => $article->id,
                'tipo_movimiento' => MovementType::AJUSTE,
                'cantidad' => $cantidad,
                'stock_anterior' => $stockAnterior,
                'stock_posterior' => $newStock,
                'referencia_tipo' => 'AJUSTE',
                'justificacion' => $justificacion,
                'fecha' => now(),
                'socio_id' => $socio->id,
                'fecha_creacion' => now(),
            ]);

            $article->update(['stock_actual' => $newStock]);

            $this->checkReorderAlert($article);

            return $movement;
        });
    }

    public function validateStockAvailability(Article $article, int $quantity): bool
    {
        return $article->stock_actual >= $quantity;
    }

    public function checkReorderAlert(Article $article): void
    {
        if ($article->isLowStock()) {
            $this->generateLowStockNotification($article);
        }
    }

    public function generateLowStockNotifications(): void
    {
        $articles = Article::active()->lowStock()->get();

        foreach ($articles as $article) {
            $exists = Notification::where('tipo', 'INVENTORY_LOW')
                ->where('referencia_tipo', 'Article')
                ->where('referencia_id', $article->id)
                ->where('leida', false)
                ->exists();

            if (!$exists) {
                $this->generateLowStockNotification($article);
            }
        }
    }

    private function generateLowStockNotification(Article $article): void
    {
        $existingUnread = Notification::where('tipo', 'INVENTORY_LOW')
            ->where('referencia_tipo', 'Article')
            ->where('referencia_id', $article->id)
            ->where('leida', false)
            ->exists();

        if ($existingUnread) {
            return;
        }

        $adminUsers = \App\Models\User::where('rol', 'ADMIN')->where('activo', true)->get();

        foreach ($adminUsers as $user) {
            Notification::create([
                'usuario_id' => $user->id,
                'tipo' => 'INVENTORY_LOW',
                'titulo' => 'Stock bajo',
                'mensaje' => "El articulo '{$article->nombre}' tiene stock bajo ({$article->stock_actual} unidades, umbral: {$article->umbral_reposicion})",
                'leida' => false,
                'referencia_tipo' => 'Article',
                'referencia_id' => $article->id,
                'fecha' => now(),
            ]);
        }
    }

    public function getStockReport(): array
    {
        $articles = Article::with('supplier')->active()->get();

        return [
            'total_articulos' => $articles->count(),
            'valor_total' => $articles->sum(fn($a) => $a->stock_actual * (float) $a->costo_unitario),
            'articulos_stock_bajo' => $articles->filter(fn($a) => $a->isLowStock())->count(),
            'articulos_sin_stock' => $articles->filter(fn($a) => $a->stock_actual === 0)->count(),
        ];
    }

    public function getArticleMovementHistory(Article $article, int $perPage = 20)
    {
        return $article->movements()
            ->with(['socio'])
            ->orderBy('fecha', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($perPage);
    }

    public function getLowStockReport()
    {
        return Article::with('supplier')
            ->active()
            ->lowStock()
            ->orderBy('stock_actual', 'asc')
            ->get();
    }
}
