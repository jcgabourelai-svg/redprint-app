<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    /**
     * Pasa si el usuario autenticado tiene ALGUNO de los permisos indicados.
     * Los roles sistema (es_sistema) pasan automaticamente.
     */
    public function handle(Request $request, Closure $next, string ...$claves): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        foreach ($claves as $clave) {
            if ($user->tienePermiso($clave)) {
                return $next($request);
            }
        }

        return response()->json(['message' => 'No autorizado'], 403);
    }
}
