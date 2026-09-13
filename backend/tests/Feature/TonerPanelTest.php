<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Reading;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TonerPanelTest extends TestCase
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

    /** Usuario NO sistema: recibe exactamente los permisos indicados (con [] no recibe ninguno). */
    private function userWithPermissions(array $claves): User
    {
        $role = Role::create([
            'nombre' => 'Rol Test',
            'slug' => 'rol-test-' . uniqid(),
            'es_sistema' => false,
        ]);

        foreach ($claves as $clave) {
            $permiso = Permission::firstOrCreate(
                ['clave' => $clave],
                ['modulo' => 'test', 'etiqueta' => $clave]
            );
            $role->permissions()->attach($permiso->id);
        }

        return User::create([
            'nombre' => 'User Test',
            'correo' => 'user-' . uniqid() . '@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0101',
            'rol_id' => $role->id,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function setupContractWithPrinter(User $admin, int $lecturaInicial): array
    {
        $client = Client::create([
            'razon_social' => 'Cliente ' . uniqid(),
            'rfc' => strtoupper(substr(md5(uniqid()), 0, 10)),
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp'], ['nombre' => 'HP']);
        $model = PrinterModel::firstOrCreate(
            ['brand_id' => $brand->id, 'nombre' => 'LaserJet Pro M404 ' . uniqid()]
        );

        $printer = Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet Pro M404',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'EQ-' . uniqid(),
            'estado' => PrinterStatus::RENTADA,
            'contador_actual' => $lecturaInicial,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $contract = Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today()->subDays(30),
            'tarifa_base' => 1000,
            'paginas_incluidas' => 0,
            'costo_pag_excedente' => 0.01,
            'dias_gracia' => 15,
            'frecuencia_visitas' => 'MENSUAL',
            'dias_adelanto' => 7,
            'estado' => ContractStatus::ACTIVO,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => today()->subDays(30),
            'lectura_inicial' => $lecturaInicial,
            'activa' => true,
            'alias' => 'Recepción',
        ]);

        return [$contract, $printer];
    }

    private function lectura(User $socio, Contract $contract, Printer $printer, string $fecha, int $contador, ?array $niveles = null, ?int $paginas = null): Reading
    {
        // COMPLETADA: la visita de una lectura ya ocurrió; solo la visita
        // pendiente explícita debe contar como "próxima" en el cruce.
        $visita = Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => $fecha,
            'socio_id' => $socio->id,
            'estado' => VisitStatus::COMPLETADA,
            'creado_por' => $socio->id,
            'fecha_creacion' => now(),
        ]);

        return Reading::create([
            'visita_id' => $visita->id,
            'impresora_id' => $printer->id,
            'contrato_id' => $contract->id,
            'fecha' => $fecha,
            'valor_contador' => $contador,
            'paginas_periodo' => $paginas ?? 0,
            'niveles_toner' => $niveles,
            'socio_id' => $socio->id,
            'creado_por' => $socio->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function visitaPendiente(User $admin, Contract $contract, string $fecha): Visit
    {
        return Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => $fecha,
            'socio_id' => $admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);
    }

    // ---------------------------------------------------------------
    // GET /toner/panel
    // ---------------------------------------------------------------

    public function test_panel_requiere_sesion(): void
    {
        $this->getJson('/api/v1/toner/panel')->assertUnauthorized();
    }

    public function test_panel_prohibido_sin_permiso_de_lecturas(): void
    {
        Sanctum::actingAs($this->userWithPermissions([]));

        $this->getJson('/api/v1/toner/panel')->assertForbidden();
    }

    public function test_panel_devuelve_impresoras_bajas_y_excluye_sanas_sin_estimado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$contractBaja, $printerBaja] = $this->setupContractWithPrinter($admin, 1000);
        $this->lectura($admin, $contractBaja, $printerBaja, today()->toDateString(), 1200, ['k' => 10]);

        [$contractSana, $printerSana] = $this->setupContractWithPrinter($admin, 5000);
        $this->lectura($admin, $contractSana, $printerSana, today()->toDateString(), 5100, ['k' => 40]);

        $response = $this->getJson('/api/v1/toner/panel')->assertOk();

        $impresoras = $response->json('impresoras');

        $this->assertCount(1, $impresoras);
        $this->assertSame($printerBaja->id, $impresoras[0]['impresora_id']);
        $this->assertSame('k', $impresoras[0]['color_critico']);
        $this->assertSame(10, $impresoras[0]['nivel_critico']);
        $this->assertNull($impresoras[0]['dias_para_agotarse']);
        $this->assertSame(['k' => 10], $impresoras[0]['niveles']);
        $this->assertSame('Recepción', $impresoras[0]['alias']);
        $this->assertSame($contractBaja->cliente_id, $impresoras[0]['cliente_id']);
        $this->assertNotNull($impresoras[0]['cliente_nombre']);
    }

    public function test_panel_incluye_nivel_alto_cuando_el_estimado_es_urgente(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        // 60%@10.000 → 40%@11.000 con 1.000 págs en 5 días (200/día):
        // ~2.000 págs restantes ⇒ ~10 días (≤14) aunque el nivel sea 40%.
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 10000);
        $this->lectura($admin, $contract, $printer, today()->subDays(5)->toDateString(), 10000, ['k' => 60], 0);
        $this->lectura($admin, $contract, $printer, today()->toDateString(), 11000, ['k' => 40], 1000);

        $response = $this->getJson('/api/v1/toner/panel')->assertOk();

        $impresoras = $response->json('impresoras');

        $this->assertCount(1, $impresoras);
        $this->assertSame($printer->id, $impresoras[0]['impresora_id']);
        $this->assertSame(40, $impresoras[0]['nivel_critico']);
        $this->assertSame(2000, $impresoras[0]['paginas_restantes']);
        $this->assertSame(10, $impresoras[0]['dias_para_agotarse']);
    }

    public function test_panel_ordena_por_dias_y_deja_sin_estimados_al_final(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        // ~3 días: 60%@10.000 → 12%@13.000, 3.000 págs en 12 días (250/día).
        [$contractP1, $printerP1] = $this->setupContractWithPrinter($admin, 10000);
        $this->lectura($admin, $contractP1, $printerP1, today()->subDays(12)->toDateString(), 10000, ['k' => 60], 0);
        $this->lectura($admin, $contractP1, $printerP1, today()->toDateString(), 13000, ['k' => 12], 3000);

        // ~12 días: 48%@10.000 → 24%@12.000, 2.000 págs en 10 días (200/día).
        [$contractP2, $printerP2] = $this->setupContractWithPrinter($admin, 10000);
        $this->lectura($admin, $contractP2, $printerP2, today()->subDays(10)->toDateString(), 10000, ['k' => 48], 0);
        $this->lectura($admin, $contractP2, $printerP2, today()->toDateString(), 12000, ['k' => 24], 2000);

        // Sin estimado (una sola lectura) pero nivel ≤ umbral.
        [$contractP3, $printerP3] = $this->setupContractWithPrinter($admin, 1000);
        $this->lectura($admin, $contractP3, $printerP3, today()->toDateString(), 1200, ['k' => 5]);

        $response = $this->getJson('/api/v1/toner/panel')->assertOk();

        $this->assertSame(
            [$printerP1->id, $printerP2->id, $printerP3->id],
            array_column($response->json('impresoras'), 'impresora_id')
        );
    }

    public function test_panel_cruza_con_proxima_visita(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        // Caso A: ~10 días de tóner, visita en 5 ⇒ alcanza (false).
        [$contractA, $printerA] = $this->setupContractWithPrinter($admin, 10000);
        $this->lectura($admin, $contractA, $printerA, today()->subDays(30)->toDateString(), 10000, ['k' => 80], 0);
        $this->lectura($admin, $contractA, $printerA, today()->toDateString(), 16000, ['k' => 20], 6000);
        $this->visitaPendiente($admin, $contractA, today()->addDays(5)->toDateString());

        // Caso B: ~2 días de tóner (2.000×8÷6.000), visita en 5 ⇒ se agota antes (true).
        [$contractB, $printerB] = $this->setupContractWithPrinter($admin, 10000);
        $this->lectura($admin, $contractB, $printerB, today()->subDays(8)->toDateString(), 10000, ['k' => 80], 0);
        $this->lectura($admin, $contractB, $printerB, today()->toDateString(), 16000, ['k' => 20], 6000);
        $this->visitaPendiente($admin, $contractB, today()->addDays(5)->toDateString());

        $impresoras = $this->getJson('/api/v1/toner/panel')->assertOk()->json('impresoras');

        $porId = collect($impresoras)->keyBy('impresora_id');

        $itemA = $porId->get($printerA->id);
        $this->assertSame(10, $itemA['dias_para_agotarse']);
        $this->assertSame(today()->addDays(5)->toDateString(), $itemA['proxima_visita_fecha']);
        $this->assertFalse($itemA['urgente_antes_de_visita']);
        $this->assertSame('Admin Test', $itemA['proxima_visita_socio_nombre']);

        $itemB = $porId->get($printerB->id);
        $this->assertSame(2, $itemB['dias_para_agotarse']);
        $this->assertTrue($itemB['urgente_antes_de_visita']);
    }

    public function test_panel_excluye_impresoras_no_rentadas(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$contract, $printerRentada] = $this->setupContractWithPrinter($admin, 1000);
        $this->lectura($admin, $contract, $printerRentada, today()->toDateString(), 1200, ['k' => 10]);

        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp'], ['nombre' => 'HP']);
        $model = PrinterModel::firstOrCreate(['brand_id' => $brand->id, 'nombre' => 'LaserJet almacén ' . uniqid()]);

        $printerAlmacen = Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet almacén',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'EQ-' . uniqid(),
            'estado' => PrinterStatus::EN_ALMACEN,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $this->lectura($admin, $contract, $printerAlmacen, today()->toDateString(), 800, ['k' => 5]);

        $impresoras = $this->getJson('/api/v1/toner/panel')->assertOk()->json('impresoras');

        $this->assertCount(1, $impresoras);
        $this->assertSame($printerRentada->id, $impresoras[0]['impresora_id']);
    }

    public function test_panel_ignora_lecturas_de_otras_impresoras(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        // A: nivel 40% sin par de lecturas (no estimable, no bajo) ⇒ fuera.
        [$contractA, $printerA] = $this->setupContractWithPrinter($admin, 10000);
        $this->lectura($admin, $contractA, $printerA, today()->toDateString(), 10100, ['k' => 40]);

        // B (otro contrato): nivel bajo ⇒ dentro.
        [$contractB, $printerB] = $this->setupContractWithPrinter($admin, 5000);
        $this->lectura($admin, $contractB, $printerB, today()->toDateString(), 5100, ['k' => 8]);

        $impresoras = $this->getJson('/api/v1/toner/panel')->assertOk()->json('impresoras');

        $this->assertCount(1, $impresoras);
        $this->assertSame($printerB->id, $impresoras[0]['impresora_id']);
    }

    // ---------------------------------------------------------------
    // GET /printers/{printer}/toner
    // ---------------------------------------------------------------

    public function test_printer_toner_endpoint_expone_estimados_y_cambios(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$contract, $printer] = $this->setupContractWithPrinter($admin, 10000);
        $this->lectura($admin, $contract, $printer, today()->subDays(10)->toDateString(), 10000, ['k' => 100], 0);
        $this->lectura($admin, $contract, $printer, today()->toDateString(), 13000, ['k' => 60], 3000);

        $response = $this->getJson("/api/v1/printers/{$printer->id}/toner")->assertOk();

        $response->assertJsonStructure([
            'niveles_actuales',
            'fecha_ultimo_nivel',
            'por_color' => ['k' => ['paginas_restantes', 'dias']],
            'color_critico',
            'nivel_critico',
            'rendimiento_real_modelo',
            'cambios',
        ]);

        $this->assertSame(4500, $response->json('por_color.k.paginas_restantes'));
        $this->assertSame(15, $response->json('por_color.k.dias'));
        $this->assertSame(['k' => 60], $response->json('niveles_actuales'));
    }

    public function test_printer_toner_endpoint_prohibido_sin_permiso_de_impresoras(): void
    {
        $admin = $this->adminUser();
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        Sanctum::actingAs($this->userWithPermissions(['operaciones.lecturas']));

        $this->getJson("/api/v1/printers/{$printer->id}/toner")->assertForbidden();
    }
}
