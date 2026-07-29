<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePrinterBrandRequest;
use App\Http\Resources\PrinterBrandResource;
use App\Models\PrinterBrand;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PrinterBrandController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PrinterBrand::query()->orderBy('nombre');

        if ($request->boolean('with_modelos') || $request->input('with') === 'modelos') {
            $query->with(['modelos' => fn ($q) => $q->orderBy('nombre')]);
        }

        return response()->json(PrinterBrandResource::collection($query->get()));
    }

    public function store(StorePrinterBrandRequest $request): JsonResponse
    {
        $slug = PrinterBrand::slugFrom($request->input('nombre'));

        $brand = PrinterBrand::where('slug', $slug)->first();

        if (!$brand) {
            $brand = PrinterBrand::create([
                'nombre' => trim($request->input('nombre')),
                'slug' => $slug,
            ]);
        }

        return response()->json(new PrinterBrandResource($brand), 201);
    }
}
