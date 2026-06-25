<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserRole
{
    /**
     * Middleware legacy por rol. Mantiene compatibilidad con el alias `role`,
     * pero ahora resuelve el rol via la relacion `role` (slug o nombre).
     * El control de acceso principal usa el middleware `permission:`.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        if ($user->isAdmin()) {
            return $next($request);
        }

        $role = $user->role;

        if (!$role || !in_array($role->slug, $roles) && !in_array($role->nombre, $roles)) {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        return $next($request);
    }
}
