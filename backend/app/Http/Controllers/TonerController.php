<?php

namespace App\Http\Controllers;

use App\Models\Printer;
use App\Services\TonerService;
use Illuminate\Http\JsonResponse;

/**
 * Estimados de tóner (informativos, nunca cobro). Delgado: todo el cálculo
 * vive en TonerService.
 */
class TonerController extends Controller
{
    public function __construct(
        private TonerService $tonerService
    ) {}

    /** GET /toner/panel — widget del dashboard (permiso operaciones.lecturas). */
    public function panel(): JsonResponse
    {
        return response()->json(['impresoras' => $this->tonerService->panelBajo()]);
    }

    /** GET /printers/{printer}/toner — estimados + cambios detectados. */
    public function printer(Printer $printer): JsonResponse
    {
        return response()->json(
            $this->tonerService->estimados($printer)
                + ['cambios' => $this->tonerService->cambiosDetectados($printer, 10)]
        );
    }
}
