<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreArticleRequest;
use App\Http\Requests\StoreManualMovementRequest;
use App\Http\Requests\UpdateArticleRequest;
use App\Http\Resources\ArticleResource;
use App\Http\Resources\InventoryMovementResource;
use App\Http\Resources\PrinterModelResource;
use App\Models\Article;
use App\Services\InventoryService;
use App\Traits\Sortable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleController extends Controller
{
    use Sortable;

    public function __construct(
        private InventoryService $inventoryService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Article::with('supplier');
        if ($request->has('tipo')) {
            $query->where('tipo_articulo', $request->tipo);
        }
        if ($request->has('subtipo')) {
            $query->where('subtipo', $request->subtipo);
        }
        if ($request->has('proveedor_id')) {
            $query->where('proveedor_id', $request->proveedor_id);
        }
        if ($request->boolean('stock_bajo')) {
            $query->whereColumn('stock_actual', '<=', 'umbral_reposicion');
        }
        $query->search($request->search, ['nombre', 'marca', 'modelo_sku']);
        if ($request->has('activo')) {
            $query->where('activo', $request->boolean('activo'));
        } else {
            $query->active();
        }

        // Ordenamiento controlado por el cliente sobre TODO el dataset.
        // Se aplica antes de paginar para que cada página refleje el orden global.
        $this->applySorting($query, $request, [
            'id',
            'nombre',
            'tipo_articulo',
            'marca',
            'modelo_sku',
            'stock_actual',
            'umbral_reposicion',
            'costo_unitario',
            'fecha_creacion',
        ], 'nombre', 'asc');

        $articles = $query->paginate($request->per_page ?? 20);

        return response()->json($articles);
    }

    public function show(Article $article): JsonResponse
    {
        return response()->json(new ArticleResource($article->load(['supplier', 'movements.socio', 'modelosCompatibles.brand'])));
    }

    public function store(StoreArticleRequest $request): JsonResponse
    {
        $data = $request->validated();
        $modelosCompatibles = $data['modelos_compatibles'] ?? [];
        unset($data['modelos_compatibles']);

        $article = Article::create($data);
        $article->modelosCompatibles()->sync($modelosCompatibles);

        return response()->json(new ArticleResource($article->load(['supplier', 'modelosCompatibles.brand'])), 201);
    }

    public function update(UpdateArticleRequest $request, Article $article): JsonResponse
    {
        $data = $request->validated();
        $modelosCompatibles = array_key_exists('modelos_compatibles', $data) ? $data['modelos_compatibles'] : null;
        unset($data['modelos_compatibles']);

        $nuevoStock = array_key_exists('stock_actual', $data) ? (int) $data['stock_actual'] : null;
        unset($data['stock_actual']);

        $article->update($data);

        if ($nuevoStock !== null && $nuevoStock !== (int) $article->fresh()->stock_actual) {
            $this->inventoryService->registerAdjustment(
                $article,
                $nuevoStock,
                $request->user(),
                'Ajuste desde edición del artículo',
                'EDICION'
            );
        }

        if ($modelosCompatibles !== null) {
            $article->modelosCompatibles()->sync($modelosCompatibles);
        }

        return response()->json(new ArticleResource($article->fresh(['supplier', 'modelosCompatibles.brand'])));
    }

    public function movements(Article $article, Request $request): JsonResponse
    {
        $movements = $article->movements()
            ->with('socio')
            ->orderBy('fecha', 'desc')
            ->paginate($request->per_page ?? 20);

        return InventoryMovementResource::collection($movements)->response();
    }

    public function storeMovement(StoreManualMovementRequest $request, Article $article): JsonResponse
    {
        $data = $request->validated();
        $socio = $request->user();
        $justificacion = $data['justificacion'];

        $tipo = $data['tipo_movimiento'];

        $movement = match ($tipo) {
            'ENTRADA' => $this->inventoryService->registerEntry(
                $article,
                (int) $data['cantidad'],
                $socio,
                'AJUSTE_MANUAL',
                null,
                $justificacion
            ),
            'SALIDA' => $this->inventoryService->registerExit(
                $article,
                (int) $data['cantidad'],
                $socio,
                'AJUSTE_MANUAL',
                null,
                $justificacion
            ),
            'AJUSTE' => $this->inventoryService->registerAdjustment(
                $article,
                (int) $data['stock_destino'],
                $socio,
                $justificacion,
                'AJUSTE_MANUAL'
            ),
        };

        return response()->json(new InventoryMovementResource($movement->load(['article', 'socio'])), 201);
    }

    public function compatibleModels(Article $article): JsonResponse
    {
        $models = $article->modelosCompatibles()->with('brand')->get();

        return response()->json(PrinterModelResource::collection($models));
    }

    public function destroy(Article $article, Request $request): JsonResponse
    {
        if (! $article->activo) {
            return response()->json(['message' => 'El artículo ya está dado de baja'], 409);
        }

        $rawReason = $request->input('reason');
        $reason = ($rawReason !== null && trim((string) $rawReason) !== '') ? $rawReason : 'Dada de baja por usuario';

        $article->activo = false;
        $article->motivo_baja = $reason;
        $article->fecha_baja = now();
        $article->save();

        return response()->json(['message' => 'Artículo dado de baja', 'reason' => $reason]);
    }
}
