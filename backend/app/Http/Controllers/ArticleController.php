<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreArticleRequest;
use App\Http\Requests\UpdateArticleRequest;
use App\Http\Resources\ArticleResource;
use App\Http\Resources\InventoryMovementResource;
use App\Models\Article;
use App\Models\Printer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleController extends Controller
{
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
        if ($request->filled('buscar')) {
            $buscar = $request->buscar;
            $query->where(function ($q) use ($buscar) {
                $q->where('nombre', 'like', "%{$buscar}%")
                    ->orWhere('marca', 'like', "%{$buscar}%")
                    ->orWhere('modelo_sku', 'like', "%{$buscar}%");
            });
        }
        if ($request->has('activo')) {
            $query->where('activo', $request->boolean('activo'));
        } else {
            $query->active();
        }

        $articles = $query->orderBy('nombre')->paginate($request->per_page ?? 20);

        return response()->json($articles);
    }

    public function show(Article $article): JsonResponse
    {
        return response()->json(new ArticleResource($article->load('supplier', 'movements.socio')));
    }

    public function store(StoreArticleRequest $request): JsonResponse
    {
        $article = Article::create($request->validated());

        return response()->json(new ArticleResource($article->load('supplier')), 201);
    }

    public function update(UpdateArticleRequest $request, Article $article): JsonResponse
    {
        $article->update($request->validated());

        return response()->json(new ArticleResource($article->fresh('supplier')));
    }

    public function movements(Article $article, Request $request): JsonResponse
    {
        $movements = $article->movements()
            ->with('socio')
            ->orderBy('fecha', 'desc')
            ->paginate($request->per_page ?? 20);

        return InventoryMovementResource::collection($movements)->response();
    }

    public function compatiblePrinters(Article $article): JsonResponse
    {
        $printerIds = $article->impresoras_compatibles ?? [];

        $printers = Printer::whereIn('id', $printerIds)->get();

        return response()->json($printers);
    }
}
