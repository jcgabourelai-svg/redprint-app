<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePrinterModelRequest;
use App\Http\Resources\PrinterModelResource;
use App\Models\PrinterModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrinterModelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PrinterModel::query()->orderBy('nombre');

        if ($request->has('brand_id')) {
            $query->where('brand_id', $request->integer('brand_id'));
        }

        if ($request->boolean('with_brand')) {
            $query->with('brand');
        }

        return response()->json(PrinterModelResource::collection($query->get()));
    }

    public function store(StorePrinterModelRequest $request): JsonResponse
    {
        $brandId = $request->integer('brand_id');
        $nombre = trim($request->input('nombre'));

        $model = PrinterModel::firstOrCreate([
            'brand_id' => $brandId,
            'nombre' => $nombre,
        ]);

        if ($request->has('es_color')) {
            $model->update(['es_color' => (bool) $request->input('es_color')]);
        }

        return response()->json(new PrinterModelResource($model->load('brand')), 201);
    }

    /**
     * Correccion puntual del catalogo (p. ej. es_color tras un backfill
     * imperfecto). No hay UI admin de modelos: la API es la via de ajuste.
     */
    public function update(Request $request, PrinterModel $model): JsonResponse
    {
        $data = $request->validate([
            'es_color' => 'nullable|boolean',
            'nombre' => 'sometimes|string|max:255',
        ]);

        $model->update(array_filter($data, fn ($v) => $v !== null));

        return response()->json(new PrinterModelResource($model->load('brand')));
    }
}
