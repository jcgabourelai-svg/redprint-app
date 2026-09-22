<?php

namespace Tests\Feature;

use App\Enums\MaintenanceStatus;
use App\Enums\PrinterStatus;
use App\Models\MaintenanceOrder;
use App\Models\MaintenancePlan;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenancePlanTest extends TestCase
{
    use RefreshDatabase;

    private function adminUser(): User
    {
        $role = Role::create([
            'nombre' => 'Admin Test',
            'slug' => 'admin-test-' . uniqid(),
            'es_sistema' => true,
        ]);

        return User::create([
            'nombre' => 'Admin Test',
            'correo' => 'admin-' . uniqid() . '@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0100',
            'rol_id' => $role->id,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function createPrinter(User $user): Printer
    {
        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp-' . substr(md5(uniqid()), 0, 4)], ['nombre' => 'HP']);

        $model = PrinterModel::create([
            'brand_id' => $brand->id,
            'nombre' => 'LaserJet Test ' . substr(md5(uniqid()), 0, 6),
        ]);

        return Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet Test',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'IMP-' . uniqid(),
            'estado' => PrinterStatus::EN_ALMACEN,
            'contador_actual' => 1000,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function crearPlan(array $overrides = []): MaintenancePlan
    {
        return MaintenancePlan::create(array_merge([
            'activo' => true,
            'periodicidad_meses' => 6,
            'ventana_aviso_dias' => 15,
        ], $overrides));
    }

    public function test_plan_efectivo_impresora_gana_sobre_modelo(): void
    {
        $admin = $this->adminUser();
        $printer = $this->createPrinter($admin);

        $planModelo = $this->crearPlan(['printer_model_id' => $printer->printer_model_id, 'periodicidad_meses' => 12]);
        $planImpresora = $this->crearPlan(['printer_id' => $printer->id, 'periodicidad_meses' => 3]);

        $service = app(\App\Services\MaintenancePlanService::class);

        $efectivo = $service->planEfectivo($printer);
        $this->assertSame($planImpresora->id, $efectivo->id);

        // Sin plan por impresora cae al del modelo.
        $planImpresora->update(['activo' => false]);
        $efectivo2 = $service->planEfectivo($printer->fresh());
        $this->assertSame($planModelo->id, $efectivo2->id);
    }

    public function test_backfill_desde_ultima_preventiva_completada(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        MaintenanceOrder::create([
            'impresora_id' => $printer->id,
            'fecha' => today()->subMonths(4),
            'tipo_mantto' => 'PREVENTIVO',
            'desc_problema' => 'Preventivo viejo',
            'estado' => MaintenanceStatus::COMPLETADA,
            'socio_id' => $admin->id,
            'costo_total' => 0,
            'fecha_creacion' => now()->subMonths(4),
            'fecha_completado' => now()->subMonths(4),
        ]);

        $plan = $this->crearPlan(['printer_id' => $printer->id, 'periodicidad_meses' => 6]);

        $response = $this->postJson('/api/v1/maintenance-plans', [
            'printer_id' => $printer->id,
            'periodicidad_meses' => 6,
            'ventana_aviso_dias' => 15,
        ])->assertCreated();

        // ultimo = hace 4 meses => proximo = hace 4 meses + 6 = dentro de 2 meses.
        $this->assertSame(
            now()->subMonths(4)->startOfDay()->toDateString(),
            MaintenancePlan::find($response->json('id'))->ultimo_servicio_fecha->toDateString()
        );
        $this->assertSame(
            now()->subMonths(4)->addMonthsNoOverflow(6)->toDateString(),
            MaintenancePlan::find($response->json('id'))->proximo_servicio_fecha->toDateString()
        );

        $plan->delete();
    }

    public function test_crear_orden_desde_sugerencia_es_idempotente(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        $plan = $this->crearPlan(['printer_id' => $printer->id]);

        $primerIntento = $this->postJson("/api/v1/maintenance-plans/{$plan->id}/create-order", [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
        ])->assertCreated();

        $ordenId = $primerIntento->json('orden.id');
        $this->assertNotNull($ordenId);

        $orden = MaintenanceOrder::find($ordenId);
        $this->assertSame('PREVENTIVO', $orden->tipo_mantto->value);
        $this->assertSame($plan->id, $orden->maintenance_plan_id);

        // Segunda llamada: 422, no duplica.
        $segundo = $this->postJson("/api/v1/maintenance-plans/{$plan->id}/create-order", [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
        ])->assertStatus(422);

        $this->assertStringContainsString('ya tiene una orden PROGRAMADA', $segundo->json('message'));
        $this->assertSame(1, MaintenanceOrder::where('impresora_id', $printer->id)->count());
    }

    public function test_completar_preventiva_recalcula_plan_en_transaccion(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        $plan = $this->crearPlan(['printer_id' => $printer->id, 'periodicidad_meses' => 3, 'periodicidad_paginas' => 50000]);

        $orderId = $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'PREVENTIVO',
            'desc_problema' => 'Preventivo programado',
        ])->assertCreated()->json('id');

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Limpieza general',
            'costo_mano_obra' => 200,
            'contador_impresora' => 1200,
        ])->assertOk();

        $plan = $plan->fresh();

        $this->assertSame(today()->toDateString(), $plan->ultimo_servicio_fecha->toDateString());
        $this->assertSame(1200, $plan->ultimo_servicio_contador);
        $this->assertSame(
            today()->addMonthsNoOverflow(3)->toDateString(),
            $plan->proximo_servicio_fecha->toDateString()
        );
        $this->assertSame(1200 + 50000, $plan->proximo_servicio_contador);
    }

    public function test_cadencia_doble_vence_con_el_primero_que_llegue(): void
    {
        $admin = $this->adminUser();
        $printer = $this->createPrinter($admin);

        // Meses lejanos (12), páginas ya rebasadas: vence por PÁGINAS.
        $plan = $this->crearPlan([
            'printer_id' => $printer->id,
            'periodicidad_meses' => 12,
            'periodicidad_paginas' => 5000,
            'ultimo_servicio_fecha' => today()->toDateString(),
            'ultimo_servicio_contador' => 1000,
        ]);

        $service = app(\App\Services\MaintenancePlanService::class);
        $service->recalcularProximo($plan->fresh());

        // Contador actual 1000 + 5000 = 6000; la impresora tiene 1000 => no
        // rebasado aún. Avanzamos el contador para forzar el vencimiento.
        $printer->update(['contador_actual' => 6100]);

        $upcoming = $service->upcoming();
        $fila = $upcoming->first(fn ($f) => $f['impresora_id'] === $printer->id);

        $this->assertNotNull($fila);
        $this->assertSame('VENCIDO', $fila['estado']);
        $this->assertSame(-100, $fila['paginas_restantes']);

        // Caso espejo: fecha vencida con páginas lejanas => vence por FECHA.
        $printer2 = $this->createPrinter($admin);
        $plan2 = $this->crearPlan([
            'printer_id' => $printer2->id,
            'periodicidad_meses' => 1,
            'periodicidad_paginas' => 500000,
            'ultimo_servicio_fecha' => today()->subMonths(2)->toDateString(),
            'ultimo_servicio_contador' => 1000,
        ]);
        $service->recalcularProximo($plan2->fresh());

        $upcoming2 = $service->upcoming();
        $fila2 = $upcoming2->first(fn ($f) => $f['impresora_id'] === $printer2->id);

        $this->assertNotNull($fila2);
        $this->assertSame('VENCIDO', $fila2['estado']);
        $this->assertNotNull($fila2['dias_restantes']);
        $this->assertTrue($fila2['dias_restantes'] < 0);
    }

    public function test_sync_plans_es_idempotente(): void
    {
        $admin = $this->adminUser();
        $printer = $this->createPrinter($admin);

        $plan = $this->crearPlan([
            'printer_id' => $printer->id,
            'periodicidad_meses' => 6,
            'ultimo_servicio_fecha' => today()->subMonths(2)->toDateString(),
        ]);

        Artisan::call('maintenance:sync-plans');
        $plan1 = $plan->fresh();
        $estado1 = [
            'proximo_servicio_fecha' => $plan1->proximo_servicio_fecha?->toDateString(),
            'proximo_servicio_contador' => $plan1->proximo_servicio_contador,
            'ultimo_servicio_fecha' => $plan1->ultimo_servicio_fecha?->toDateString(),
        ];

        Artisan::call('maintenance:sync-plans');
        $plan2 = $plan->fresh();
        $estado2 = [
            'proximo_servicio_fecha' => $plan2->proximo_servicio_fecha?->toDateString(),
            'proximo_servicio_contador' => $plan2->proximo_servicio_contador,
            'ultimo_servicio_fecha' => $plan2->ultimo_servicio_fecha?->toDateString(),
        ];

        $this->assertSame($estado1, $estado2);
        $this->assertSame(
            today()->subMonths(2)->addMonthsNoOverflow(6)->toDateString(),
            $estado1['proximo_servicio_fecha']
        );
    }

    public function test_batch_respeta_idempotencia_y_reporta_omitidas(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer1 = $this->createPrinter($admin);
        $printer2 = $this->createPrinter($admin);

        $plan1 = $this->crearPlan(['printer_id' => $printer1->id]);
        $plan2 = $this->crearPlan(['printer_id' => $printer2->id]);

        // printer2 ya tiene orden PROGRAMADA: debe quedar omitida.
        $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer2->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Falla previa',
            'severidad' => 'MEDIA',
        ])->assertCreated();

        $response = $this->postJson('/api/v1/maintenance-plans/create-orders-batch', [
            'items' => [
                ['impresora_id' => $printer1->id, 'plan_id' => $plan1->id, 'fecha' => today()->toDateString()],
                ['impresora_id' => $printer2->id, 'plan_id' => $plan2->id, 'fecha' => today()->toDateString()],
            ],
        ])->assertStatus(201);

        $creadas = $response->json('creadas');
        $omitidas = $response->json('omitidas');

        $this->assertCount(1, $creadas);
        $this->assertSame($printer1->id, $creadas[0]['impresora_id']);
        $this->assertCount(1, $omitidas);
        $this->assertSame($printer2->id, $omitidas[0]['impresora_id']);
        $this->assertStringContainsString('ya tiene una orden PROGRAMADA', $omitidas[0]['motivo']);
    }

    public function test_validacion_requiere_exactamente_un_destino_y_una_periodicidad(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        // Ambos destinos => 422.
        $this->postJson('/api/v1/maintenance-plans', [
            'printer_id' => $printer->id,
            'printer_model_id' => $printer->printer_model_id,
            'periodicidad_meses' => 6,
        ])->assertStatus(422);

        // Sin periodicidad => 422.
        $this->postJson('/api/v1/maintenance-plans', [
            'printer_id' => $printer->id,
        ])->assertStatus(422);
    }
}
