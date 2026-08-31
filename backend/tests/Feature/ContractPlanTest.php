<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractPrinter;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Services\VisitSchedulerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ContractPlanTest extends TestCase
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

    private function createClient(User $user, string $razonSocial): Client
    {
        return Client::create([
            'razon_social' => $razonSocial,
            'rfc' => strtoupper(substr(md5($razonSocial), 0, 10)),
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function createModel(string $nombre): PrinterModel
    {
        $brand = PrinterBrand::firstOrCreate(
            ['slug' => 'hp'],
            ['nombre' => 'HP']
        );

        return PrinterModel::firstOrCreate(
            ['brand_id' => $brand->id, 'nombre' => $nombre]
        );
    }

    private function createPrinter(User $user, PrinterModel $model, int $contador = 0): Printer
    {
        return Printer::create([
            'marca' => 'HP',
            'modelo' => $model->nombre,
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'EQ-' . uniqid(),
            'estado' => PrinterStatus::EN_ALMACEN,
            'contador_actual' => $contador,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function contractPayload(Client $client, ?array $printers = null, ?array $plan = null): array
    {
        $payload = [
            'cliente_id' => $client->id,
            'fecha_inicio' => today()->toDateString(),
            'tarifa_base' => 1500,
            'paginas_incluidas' => 500,
            'costo_pag_excedente' => 0.01,
            'dias_gracia' => 15,
            'frecuencia_visitas' => 'MENSUAL',
        ];

        if ($printers !== null) {
            $payload['impresoras'] = $printers;
        }
        if ($plan !== null) {
            $payload['plan_impresoras'] = $plan;
        }

        return $payload;
    }

    public function test_crea_contrato_con_solo_plan_sin_series(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Plan SA');
        $model = $this->createModel('LaserJet Pro M404');
        $this->createPrinter($admin, $model);

        $response = $this->postJson('/api/v1/contracts', $this->contractPayload($client, null, [
            ['modelo_id' => $model->id, 'cantidad' => 2],
        ]));

        $response->assertCreated();
        $contractId = (int) $response->json('id');

        $this->assertSame(2, \DB::table('contract_printer_plan')->where('contrato_id', $contractId)->value('cantidad'));
        $this->assertDatabaseHas('contracts', ['id' => $contractId, 'estado' => ContractStatus::ACTIVO->value]);
        $this->assertSame(1, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'LECTURA')->count());
        $this->assertSame(0, Printer::where('estado', PrinterStatus::RENTADA->value)->count());
    }

    public function test_crea_contrato_con_plan_y_series_y_solo_series(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Hibrido SA');
        $model = $this->createModel('LaserJet Pro M404');
        $p1 = $this->createPrinter($admin, $model, 100);

        $this->postJson('/api/v1/contracts', $this->contractPayload($client, [
            ['id' => $p1->id, 'lectura_inicial' => 100, 'alias' => 'Recepción'],
        ], [
            ['modelo_id' => $model->id, 'cantidad' => 1],
        ]))->assertCreated();

        $hibridoId = (int) Contract::latest('id')->first()->id;
        $this->assertSame(1, \DB::table('contract_printer_plan')->where('contrato_id', $hibridoId)->count());
        $this->assertSame(1, ContractPrinter::where('contrato_id', $hibridoId)->where('activa', true)->count());

        // Retro-compatibilidad: solo series, sin plan.
        $client2 = $this->createClient($admin, 'Series SA');
        $p2 = $this->createPrinter($admin, $model, 200);
        $this->postJson('/api/v1/contracts', $this->contractPayload($client2, [
            ['id' => $p2->id, 'lectura_inicial' => 200],
        ]))->assertCreated();

        $soloSeriesId = (int) Contract::latest('id')->first()->id;
        $this->assertSame(0, \DB::table('contract_printer_plan')->where('contrato_id', $soloSeriesId)->count());
        $this->assertSame(1, ContractPrinter::where('contrato_id', $soloSeriesId)->where('activa', true)->count());
    }

    public function test_plan_con_modelo_duplicado_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Duplicado SA');
        $model = $this->createModel('LaserJet Pro M404');

        $this->postJson('/api/v1/contracts', $this->contractPayload($client, null, [
            ['modelo_id' => $model->id, 'cantidad' => 1],
            ['modelo_id' => $model->id, 'cantidad' => 2],
        ]))->assertStatus(422);

        $this->assertDatabaseCount('contracts', 0);
    }

    public function test_put_plan_reemplaza_filas_en_activo_y_rechaza_suspendido(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'UpdatePlan SA');
        $m404 = $this->createModel('LaserJet Pro M404');
        $m507 = $this->createModel('LaserJet Enterprise M507dn');

        $response = $this->postJson('/api/v1/contracts', $this->contractPayload($client, null, [
            ['modelo_id' => $m404->id, 'cantidad' => 1],
        ]));
        $response->assertCreated();
        $contractId = (int) $response->json('id');

        // Duplicado en el replace-all también es 422.
        $this->putJson("/api/v1/contracts/{$contractId}/plan", [
            'plan_impresoras' => [
                ['modelo_id' => $m404->id, 'cantidad' => 1],
                ['modelo_id' => $m404->id, 'cantidad' => 3],
            ],
        ])->assertStatus(422);

        $this->putJson("/api/v1/contracts/{$contractId}/plan", [
            'plan_impresoras' => [
                ['modelo_id' => $m507->id, 'cantidad' => 3],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('plan_impresoras.0.modelo_id', $m507->id)
            ->assertJsonPath('plan_impresoras.0.cantidad', 3);

        $this->assertDatabaseMissing('contract_printer_plan', [
            'contrato_id' => $contractId,
            'printer_model_id' => $m404->id,
        ]);
        $this->assertDatabaseHas('contract_printer_plan', [
            'contrato_id' => $contractId,
            'printer_model_id' => $m507->id,
            'cantidad' => 3,
        ]);

        Contract::find($contractId)->update(['estado' => ContractStatus::SUSPENDIDO]);

        $this->putJson("/api/v1/contracts/{$contractId}/plan", [
            'plan_impresoras' => [],
        ])->assertStatus(422);
    }

    public function test_assign_printer_sin_lectura_inicial_usa_contador_actual(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'LineaBase SA');
        $model = $this->createModel('LaserJet Pro M404');
        $p1 = $this->createPrinter($admin, $model, 5000);
        $p2 = $this->createPrinter($admin, $model, 9000);

        $response = $this->postJson('/api/v1/contracts', $this->contractPayload($client));
        $response->assertCreated();
        $contractId = (int) $response->json('id');

        // Sin lectura_inicial: la línea base es el contador físico de la serie.
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $p1->id,
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $p1->id,
            'lectura_inicial' => 5000,
            'activa' => true,
        ]);

        // El valor explícito del operador siempre gana.
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 123,
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 123,
        ]);
    }

    public function test_resource_expone_instaladas_y_pendientes(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Resource SA');
        $m404 = $this->createModel('LaserJet Pro M404');
        $m507 = $this->createModel('LaserJet Enterprise M507dn');
        $sustituto = $this->createModel('Color LaserJet Pro M283fdw');

        $p1 = $this->createPrinter($admin, $m404, 100);
        $pSustituto = $this->createPrinter($admin, $sustituto, 50);

        $response = $this->postJson('/api/v1/contracts', $this->contractPayload($client, [
            ['id' => $p1->id, 'lectura_inicial' => 100],
        ], [
            ['modelo_id' => $m404->id, 'cantidad' => 2],
            ['modelo_id' => $m507->id, 'cantidad' => 1],
        ]));
        $response->assertCreated();
        $contractId = (int) $response->json('id');

        // Sustitución legítima: modelo fuera del plan también instala.
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $pSustituto->id,
            'lectura_inicial' => 50,
        ])->assertOk();

        $show = $this->getJson("/api/v1/contracts/{$contractId}")->assertOk();

        $plan = collect($show->json('plan_impresoras'));
        $filaM404 = $plan->firstWhere('modelo_id', $m404->id);
        $filaM507 = $plan->firstWhere('modelo_id', $m507->id);

        $this->assertSame(1, $filaM404['instaladas']);
        $this->assertSame(0, $filaM507['instaladas']);
        $this->assertSame('HP', $filaM404['marca']);
        $this->assertSame('LaserJet Pro M404', $filaM404['modelo_nombre']);

        // Σcantidad = 3, activas = 2 (incluye el sustituto) → 1 pendiente.
        $this->assertSame(1, $show->json('pendientes_instalacion'));
    }

    public function test_crea_visita_instalacion_pendiente_cuando_hay_pendientes(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'VisitaInstalacion SA');
        $model = $this->createModel('LaserJet Pro M404');

        $payload = $this->contractPayload($client, null, [
            ['modelo_id' => $model->id, 'cantidad' => 2],
        ]);
        $payload['programar_visita_instalacion'] = true;
        $payload['fecha_visita_instalacion'] = today()->toDateString();

        $response = $this->postJson('/api/v1/contracts', $payload);

        $response->assertCreated();
        $contractId = (int) $response->json('id');

        $this->assertSame(1, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'INSTALACION')->count());
        $this->assertSame(1, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'LECTURA')->count());

        $this->assertDatabaseHas('visits', [
            'contrato_id' => $contractId,
            'tipo_visita' => 'INSTALACION',
            'estado' => 'PENDIENTE',
            'fecha_programada' => today()->toDateString(),
            'socio_id' => $admin->id,
            'creado_por' => $admin->id,
        ]);
    }

    public function test_opt_out_no_crea_visita_instalacion(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'OptOut SA');
        $model = $this->createModel('LaserJet Pro M404');

        $payload = $this->contractPayload($client, null, [
            ['modelo_id' => $model->id, 'cantidad' => 2],
        ]);
        $payload['programar_visita_instalacion'] = false;

        $response = $this->postJson('/api/v1/contracts', $payload);

        $response->assertCreated();
        $contractId = (int) $response->json('id');

        $this->assertSame(0, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'INSTALACION')->count());
        $this->assertSame(1, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'LECTURA')->count());
    }

    public function test_flag_de_instalacion_se_ignora_sin_pendientes(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'SinPendientes SA');
        $model = $this->createModel('LaserJet Pro M404');
        $p1 = $this->createPrinter($admin, $model, 100);
        $p2 = $this->createPrinter($admin, $model, 200);

        $payload = $this->contractPayload($client, [
            ['id' => $p1->id, 'lectura_inicial' => 100],
            ['id' => $p2->id, 'lectura_inicial' => 200],
        ], [
            ['modelo_id' => $model->id, 'cantidad' => 2],
        ]);
        $payload['programar_visita_instalacion'] = true;
        $payload['fecha_visita_instalacion'] = today()->toDateString();

        $response = $this->postJson('/api/v1/contracts', $payload);

        $response->assertCreated();
        $contractId = (int) $response->json('id');

        $this->assertSame(0, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'INSTALACION')->count());
        $this->assertSame(1, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'LECTURA')->count());
    }

    public function test_flag_true_sin_fecha_de_instalacion_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'SinFecha SA');
        $model = $this->createModel('LaserJet Pro M404');

        $payload = $this->contractPayload($client, null, [
            ['modelo_id' => $model->id, 'cantidad' => 2],
        ]);
        $payload['programar_visita_instalacion'] = true;

        $this->postJson('/api/v1/contracts', $payload)->assertStatus(422);

        $this->assertDatabaseCount('contracts', 0);
    }

    public function test_assign_printer_con_visita_instalacion_la_auto_completa(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Autocierre SA');
        $model = $this->createModel('LaserJet Pro M404');
        $printer = $this->createPrinter($admin, $model, 100);

        $payload = $this->contractPayload($client, null, [
            ['modelo_id' => $model->id, 'cantidad' => 2],
        ]);
        $payload['programar_visita_instalacion'] = true;
        $payload['fecha_visita_instalacion'] = today()->toDateString();

        $response = $this->postJson('/api/v1/contracts', $payload);
        $response->assertCreated();
        $contractId = (int) $response->json('id');

        $visita = Visit::where('contrato_id', $contractId)
            ->where('tipo_visita', 'INSTALACION')
            ->where('estado', 'PENDIENTE')
            ->first();
        $this->assertNotNull($visita);

        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $printer->id,
            'lectura_inicial' => 100,
            'visita_id' => $visita->id,
        ])->assertOk();

        $this->assertDatabaseHas('visits', [
            'id' => $visita->id,
            'estado' => 'COMPLETADA',
        ]);
        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $printer->id,
            'activa' => true,
        ]);
    }

    public function test_scheduler_regenera_lectura_con_visita_instalacion_pendiente(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'SchedulerInstalacion SA');
        $model = $this->createModel('LaserJet Pro M404');

        $payload = $this->contractPayload($client, null, [
            ['modelo_id' => $model->id, 'cantidad' => 2],
        ]);
        $payload['programar_visita_instalacion'] = true;
        $payload['fecha_visita_instalacion'] = today()->addDays(3)->toDateString();

        $response = $this->postJson('/api/v1/contracts', $payload);
        $response->assertCreated();
        $contractId = (int) $response->json('id');

        $this->assertSame(1, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'INSTALACION')->where('estado', 'PENDIENTE')->count());
        $this->assertSame(1, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'LECTURA')->where('estado', 'PENDIENTE')->count());

        Visit::where('contrato_id', $contractId)
            ->where('tipo_visita', 'LECTURA')
            ->update(['estado' => 'CANCELADA']);

        app(VisitSchedulerService::class)->generateRecurringVisits();

        $this->assertSame(1, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'LECTURA')->where('estado', 'PENDIENTE')->count());
        $this->assertSame(1, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'LECTURA')->where('estado', 'CANCELADA')->count());
        $this->assertSame(1, Visit::where('contrato_id', $contractId)->where('tipo_visita', 'INSTALACION')->where('estado', 'PENDIENTE')->count());
    }

    public function test_estimacion_advierte_plan_incompleto_y_mantiene_tarifa_base(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Estimacion SA');
        $model = $this->createModel('LaserJet Pro M404');

        $this->postJson('/api/v1/contracts', $this->contractPayload($client, null, [
            ['modelo_id' => $model->id, 'cantidad' => 2],
        ]))->assertCreated();

        $response = $this->getJson('/api/v1/invoices/calcular?' . http_build_query([
            'cliente_id' => $client->id,
            'periodo_inicio' => now()->startOfMonth()->toDateString(),
            'periodo_fin' => now()->endOfMonth()->toDateString(),
        ]))->assertOk();

        $this->assertTrue(
            collect($response->json('advertencias'))->contains(
                fn ($a) => str_contains($a, 'equipo(s) planificados sin instalar')
            )
        );
        // Sin lecturas, el contrato ACTIVO igual genera su tarifa base.
        $this->assertEqualsWithDelta(1500.0, (float) $response->json('monto_total'), 0.001);
    }
}
