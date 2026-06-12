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

    public function providerMetrics(): JsonResponse
    {
        return response()->json($this->reportService->getMaintenanceProviderMetrics());
    }

    public function problematicPrinters(Request $request): JsonResponse
    {
        $limit = $request->integer('limit', 10);

        return response()->json($this->reportService->getProblematicPrinters($limit));
    }

    public function printerMaintenanceCost(int $printerId): JsonResponse
    {
        return response()->json($this->reportService->getPrinterMaintenanceCost($printerId));
    }
}
