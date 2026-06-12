<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (!$request->user()) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $userRole = $request->user()->rol->value;

        if (!in_array($userRole, $roles)) {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        return $next($request);
    }
}
