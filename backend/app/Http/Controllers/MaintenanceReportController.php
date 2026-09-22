<?php

namespace App\Http\Controllers;

use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceReportController extends Controller
{
    public function __construct(
        private ReportService $reportService
    ) {}

    public function problematicPrinters(Request $request): JsonResponse
    {
        $limit = $request->integer('limit', 10);

        return response()->json($this->reportService->getProblematicPrinters($limit));
    }

    public function printerMaintenanceCost(int $printerId): JsonResponse
    {
        return response()->json($this->reportService->getPrinterMaintenanceCost($printerId));
    }

    public function topArticles(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fecha_desde' => 'nullable|date',
            'fecha_hasta' => 'nullable|date|after_or_equal:fecha_desde',
            'tipo_articulo' => 'nullable|in:CONSUMIBLE,REPARACION',
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        return response()->json($this->reportService->getTopUsedArticles(
            $validated['fecha_desde'] ?? null,
            $validated['fecha_hasta'] ?? null,
            $validated['tipo_articulo'] ?? null,
            $validated['limit'] ?? 20,
        ));
    }

    public function failures(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fecha_desde' => 'nullable|date',
            'fecha_hasta' => 'nullable|date|after_or_equal:fecha_desde',
        ]);

        return response()->json($this->reportService->getFailureRanking(
            $validated['fecha_desde'] ?? null,
            $validated['fecha_hasta'] ?? null,
        ));
    }
}
