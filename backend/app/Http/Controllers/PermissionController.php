<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class PermissionController extends Controller
{
    /**
     * Devuelve el catalogo de permisos agrupado por modulo.
     * Fuente unica: config/permisos.php
     */
    public function index(): JsonResponse
    {
        $catalogo = [];

        foreach (config('permisos') as $modulo => $permisos) {
            $catalogo[$modulo] = collect($permisos)->map(fn ($p) => [
                'clave' => $p['clave'],
                'etiqueta' => $p['etiqueta'],
            ])->values()->all();
        }

        return response()->json($catalogo);
    }
}
