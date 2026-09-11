<?php

namespace App\Http\Controllers\System;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\UpdateService;
use Illuminate\Http\Request;

/**
 * Endpoints del boton "Actualizar" (ConfigPage). Delgado: la logica vive en
 * UpdateService y en el orquestador del VPS. La app nunca ejecuta shell.
 */
class UpdateController extends Controller
{
    public function __construct(private UpdateService $updates)
    {
    }

    /**
     * Escribe la bandera que el cron del VPS reclamara cada minuto.
     * 202: en cola. 409: ya hay una en curso o en cola.
     */
    public function request(Request $request)
    {
        try {
            $this->updates->pedir($request->user());
        } catch (BusinessRuleException $e) {
            abort(409, $e->getMessage());
        }

        // Primer escritor real de audit_logs en el sistema.
        AuditLog::create([
            'usuario_id' => $request->user()->id,
            'accion' => 'sistema.actualizar.solicitada',
            'entidad_tipo' => 'system',
            'entidad_id' => 0,
            'ip_origen' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'fecha' => now(),
        ]);

        return response()->json(['estado' => 'en_cola'], 202);
    }

    /**
     * Estado del ultimo/presente run del orquestador + tail del log.
     */
    public function status()
    {
        $st = $this->updates->readJson('status.json') ?? [];

        return response()->json([
            'estado' => $this->updates->estadoEfectivo(),
            'rama' => $st['rama'] ?? null,
            'sha' => $st['sha'] ?? null,
            'inicio' => $st['inicio'] ?? null,
            'fin' => $st['fin'] ?? null,
            'detalle' => $st['detalle'] ?? null,
            'log' => $this->updates->log(),
        ]);
    }

    /**
     * Version instalada por el ultimo run ({sha, rama, fecha}) o null.
     */
    public function version()
    {
        return response()->json(['version' => $this->updates->version()]);
    }
}
