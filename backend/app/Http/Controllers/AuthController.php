<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('correo', $request->correo)->first();

        if (!$user || !Hash::check($request->contrasena, $user->contrasena_hash)) {
            return response()->json(['message' => 'Credenciales invalidas'], 422);
        }

        if (!$user->activo) {
            return response()->json(['message' => 'Usuario inactivo'], 403);
        }

        Auth::login($user);
        $user->update(['ultimo_acceso' => now()]);

        return response()->json([
            'user' => $user,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Sesion cerrada']);
    }

    public function user(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->role;

        return response()->json([
            'id' => $user->id,
            'nombre' => $user->nombre,
            'correo' => $user->correo,
            'telefono' => $user->telefono,
            'rol_id' => $role?->id,
            'rol_nombre' => $role?->nombre,
            'rol_slug' => $role?->slug,
            'es_sistema' => (bool) ($role?->es_sistema),
            'permisos' => $user->permisos(),
            'activo' => $user->activo,
            'ultimo_acceso' => $user->when($user->ultimo_acceso, fn () => $user->ultimo_acceso?->toIso8601String()),
            'fecha_creacion' => $user->fecha_creacion?->toIso8601String(),
        ]);
    }

    public function csrf(): JsonResponse
    {
        return response()->json(['message' => 'CSRF cookie set']);
    }
}
