<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMaintenancePlanRequest;
use App\Http\Requests\UpdateMaintenancePlanRequest;
use App\Models\MaintenancePlan;
use App\Models\Printer;
use App\Services\MaintenancePlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenancePlanController extends Controller
{
    public function __construct(
        private MaintenancePlanService $planService
    ) {}

    public function index(): JsonResponse
    {
        $planes = MaintenancePlan::with(['printerModel.brand', 'printer'])
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $planes->map(fn ($plan) => $this->presentPlan($plan)),
            'upcoming' => $this->planService->upcoming(),
        ]);
    }

    public function upcoming(): JsonResponse
    {
        return response()->json(['data' => $this->planService->upcoming()]);
    }

    public function store(StoreMaintenancePlanRequest $request): JsonResponse
    {
        $plan = new MaintenancePlan($request->validated());
        $plan->activo = $request->boolean('activo', true);

        $plan = $this->planService->syncHistorico($plan);

        return response()->json($this->presentPlan($plan->fresh(['printerModel.brand', 'printer'])), 201);
    }

    public function show(MaintenancePlan $maintenancePlan): JsonResponse
    {
        return response()->json($this->presentPlan($maintenancePlan->load(['printerModel.brand', 'printer'])));
    }

    public function update(UpdateMaintenancePlanRequest $request, MaintenancePlan $maintenancePlan): JsonResponse
    {
        $maintenancePlan->fill($request->validated());

        // Cambiar cadencia u origen re-proyecta el próximo servicio.
        $maintenancePlan = $this->planService->syncHistorico($maintenancePlan);

        return response()->json($this->presentPlan($maintenancePlan->load(['printerModel.brand', 'printer'])));
    }

    public function destroy(MaintenancePlan $maintenancePlan): JsonResponse
    {
        $maintenancePlan->update(['activo' => false]);

        return response()->json(['message' => 'Plan desactivado (se conserva el histórico de órdenes)']);
    }

    /**
     * Bandeja (uno por uno): crea la orden PREVENTIVO desde una sugerencia.
     */
    public function createOrder(Request $request, MaintenancePlan $maintenancePlan): JsonResponse
    {
        $validated = $request->validate([
            'impresora_id' => 'required|exists:printers,id',
            'fecha' => 'required|date',
        ]);

        try {
            $order = $this->planService->crearOrdenDesdeSugerencia(
                Printer::findOrFail($validated['impresora_id']),
                $maintenancePlan,
                $validated['fecha'],
                $request->user()
            );
        } catch (\App\Exceptions\BusinessRuleException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => "Orden preventiva #{$order->id} creada",
            'orden' => ['id' => $order->id, 'impresora_id' => $order->impresora_id],
        ], 201);
    }

    /**
     * Bandeja ("crear todas"): recorre las sugerencias y crea las órdenes
     * posibles; las que chocan con una orden PROGRAMADA existente se
     * reportan como omitidas (idempotencia).
     */
    public function createOrdersBatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.impresora_id' => 'required|exists:printers,id',
            'items.*.plan_id' => 'required|exists:maintenance_plans,id',
            'items.*.fecha' => 'required|date',
        ]);

        $creadas = [];
        $omitidas = [];

        foreach ($validated['items'] as $item) {
            $plan = MaintenancePlan::find($item['plan_id']);
            $printer = Printer::find($item['impresora_id']);

            try {
                $order = $this->planService->crearOrdenDesdeSugerencia(
                    $printer,
                    $plan,
                    $item['fecha'],
                    $request->user()
                );

                $creadas[] = ['orden_id' => $order->id, 'impresora_id' => $printer->id];
            } catch (\App\Exceptions\BusinessRuleException $e) {
                $omitidas[] = [
                    'impresora_id' => $printer->id,
                    'motivo' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'creadas' => $creadas,
            'omitidas' => $omitidas,
        ], 201);
    }

    private function presentPlan(MaintenancePlan $plan): array
    {
        return [
            'id' => $plan->id,
            'printer_model_id' => $plan->printer_model_id,
            'printer_id' => $plan->printer_id,
            'printer_model' => $plan->printerModel === null ? null : [
                'id' => $plan->printerModel->id,
                'nombre' => $plan->printerModel->nombre,
                'marca' => $plan->printerModel->brand?->nombre,
            ],
            'printer' => $plan->printer === null ? null : [
                'id' => $plan->printer->id,
                'marca' => $plan->printer->marca,
                'modelo' => $plan->printer->modelo,
                'codigo' => $plan->printer->codigo_negocio,
            ],
            'activo' => $plan->activo,
            'periodicidad_meses' => $plan->periodicidad_meses,
            'periodicidad_paginas' => $plan->periodicidad_paginas,
            'ventana_aviso_dias' => $plan->ventana_aviso_dias,
            'ultimo_servicio_fecha' => $plan->ultimo_servicio_fecha?->toDateString(),
            'ultimo_servicio_contador' => $plan->ultimo_servicio_contador,
            'proximo_servicio_fecha' => $plan->proximo_servicio_fecha?->toDateString(),
            'proximo_servicio_contador' => $plan->proximo_servicio_contador,
        ];
    }
}
