<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::query();

        if ($request->has('entidad_tipo')) {
            $query->where('entidad_tipo', $request->input('entidad_tipo'));
        }

        if ($request->has('entidad_id')) {
            $query->where('entidad_id', $request->input('entidad_id'));
        }

        if ($request->has('usuario_id')) {
            $query->where('usuario_id', $request->input('usuario_id'));
        }

        if ($request->has('accion')) {
            $query->where('accion', $request->input('accion'));
        }

        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->input('fecha_desde'));
        }

        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->input('fecha_hasta'));
        }

        return response()->json([
            'data' => $query->orderBy('fecha', 'desc')
                ->paginate($request->input('per_page', 50)),
        ]);
    }

    public function show($id)
    {
        $auditLog = AuditLog::findOrFail($id);
        return response()->json(['data' => $auditLog]);
    }
}