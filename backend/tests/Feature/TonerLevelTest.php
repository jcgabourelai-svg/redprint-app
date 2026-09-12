<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\FieldRecord;
use App\Models\Notification;
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

class TonerLevelTest extends TestCase
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
            ['brand_id' => $brand->id, 'nombre' => 'LaserJet Pro M404']
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
        ]);

        return [$contract, $printer];
    }

    private function crearVisita(User $admin, Contract $contract): Visit
    {
        return Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => today(),
            'socio_id' => $admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function capturar(User $admin, Contract $contract, Printer $printer, int $valor, ?array $niveles = null)
    {
        $visit = $this->crearVisita($admin, $contract);

        return $this->postJson('/api/v1/readings', array_filter([
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'contrato_id' => $contract->id,
            'fecha' => today()->toDateString(),
            'valor_contador' => $valor,
            'niveles_toner' => $niveles,
        ], fn ($v) => $v !== null));
    }

    public function test_lectura_con_niveles_toner_se_persiste_y_expone(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        $response = $this->capturar($admin, $contract, $printer, 1200, ['k' => 25, 'c' => null])
            ->assertCreated();

        // La clave c en null se normaliza fuera del payload (nada de {} ruidoso)
        $this->assertSame(['k' => 25], $response->json('reading.niveles_toner'));

        $reading = Reading::where('impresora_id', $printer->id)->first();
        $this->assertSame(['k' => 25], $reading->niveles_toner);
    }

    public function test_niveles_toner_rechaza_rangos_tipos_y_claves_fueras(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        $this->capturar($admin, $contract, $printer, 1200, ['k' => 101])
            ->assertStatus(422)
            ->assertInvalid('niveles_toner.k');

        $this->capturar($admin, $contract, $printer, 1200, ['k' => 'abc'])
            ->assertStatus(422)
            ->assertInvalid('niveles_toner.k');

        $this->capturar($admin, $contract, $printer, 1200, ['foo' => 50])
            ->assertStatus(422)
            ->assertInvalid('niveles_toner');
    }

    public function test_lectura_sin_niveles_toner_sigue_funcionando(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        $this->capturar($admin, $contract, $printer, 1200)
            ->assertCreated();

        $reading = Reading::where('impresora_id', $printer->id)->first();
        $this->assertNull($reading->niveles_toner);
    }

    public function test_field_record_lectura_con_niveles_regulariza_con_passthrough(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        $capturadoEn = now()->subDays(2);
        $record = FieldRecord::create([
            'tipo' => 'LECTURA',
            'nombre_cliente_reportado' => 'Cliente Captura',
            'valor_contador' => 1150,
            'niveles_toner' => ['k' => 30, 'm' => 80],
            'capturado_en' => $capturadoEn,
            'socio_id' => $admin->id,
            'creado_por' => $admin->id,
            'estado' => 'PENDIENTE',
        ]);

        $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
        ])->assertOk();

        $reading = Reading::findOrFail($record->fresh()->lectura_id);
        $this->assertSame(['k' => 30, 'm' => 80], $reading->niveles_toner);
    }

    public function test_lectura_con_toner_bajo_notifica_a_permisos_y_socio(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        $operador = $this->userWithPermissions(['operaciones.lecturas']);
        $sinPermiso = $this->userWithPermissions([]);

        $this->capturar($admin, $contract, $printer, 1200, ['k' => 10])
            ->assertCreated();

        $alertas = Notification::where('tipo', 'TONER_LOW')->get();

        // admin (socio capturista + permiso por rol sistema) y operador (permiso)
        $esperados = collect([$admin->id, $operador->id])->sort()->values()->all();
        $this->assertSame(2, $alertas->count());
        $this->assertSame($esperados, $alertas->pluck('usuario_id')->sort()->values()->all());
        $this->assertNotContains($sinPermiso->id, $alertas->pluck('usuario_id'));

        $alerta = $alertas->first();
        $this->assertSame('Printer', $alerta->referencia_tipo);
        $this->assertSame($printer->id, $alerta->referencia_id);
        $this->assertSame('Tóner bajo', $alerta->titulo);
        $this->assertStringContainsString('K: 10%', $alerta->mensaje);
        $this->assertStringContainsString('HP LaserJet Pro M404', $alerta->mensaje);
    }

    public function test_segunda_lectura_baja_no_duplica_mientras_haya_no_leida(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        // Solo el admin existe: exactamente 1 notificación por captura baja.
        $this->capturar($admin, $contract, $printer, 1200, ['k' => 10])->assertCreated();
        $this->assertSame(1, Notification::where('tipo', 'TONER_LOW')->count());

        $this->capturar($admin, $contract, $printer, 1300, ['k' => 12])->assertCreated();

        // La segunda lectura baja de la misma impresora no duplica (hay una no leída)
        $this->assertSame(1, Notification::where('tipo', 'TONER_LOW')->count());
    }

    public function test_lectura_regularizada_rancia_no_dispara_alerta(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        $record = FieldRecord::create([
            'tipo' => 'LECTURA',
            'nombre_cliente_reportado' => 'Cliente Captura',
            'valor_contador' => 1100,
            'niveles_toner' => ['k' => 10],
            'capturado_en' => now()->subDays(20),
            'socio_id' => $admin->id,
            'creado_por' => $admin->id,
            'estado' => 'PENDIENTE',
        ]);

        $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
        ])->assertOk();

        // El nivel llegó íntegro a la lectura, pero la frescura (7 días) calla la alerta
        $reading = Reading::findOrFail($record->fresh()->lectura_id);
        $this->assertSame(['k' => 10], $reading->niveles_toner);
        $this->assertSame(0, Notification::where('tipo', 'TONER_LOW')->count());
    }

    public function test_lectura_con_nivel_sano_no_dispara_alerta(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        $this->capturar($admin, $contract, $printer, 1200, ['k' => 40, 'c' => 60])
            ->assertCreated();

        $this->assertSame(0, Notification::where('tipo', 'TONER_LOW')->count());
    }

    public function test_put_printer_model_corrige_es_color_por_la_api(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);
        $modelId = $printer->printer_model_id;

        // El placeholder {model} debe calzar con la variable del controller
        // (PrinterModel $model): si el binding se salta, update() haría INSERT
        // y estallaría con brand_id NULL. Este test ejercita la ruta HTTP.
        $this->putJson("/api/v1/printer-models/{$modelId}", ['es_color' => true])
            ->assertOk()
            ->assertJsonPath('es_color', true);

        $this->putJson("/api/v1/printer-models/{$modelId}", ['es_color' => false])
            ->assertOk()
            ->assertJsonPath('es_color', false);

        $this->assertFalse((bool) PrinterModel::find($modelId)->es_color);
    }

    public function test_visit_show_expone_es_color_de_la_impresora(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        [$contract, $printer] = $this->setupContractWithPrinter($admin, 1000);

        $printer->printerModel->update(['es_color' => true]);

        $visit = $this->crearVisita($admin, $contract);

        $response = $this->getJson("/api/v1/visits/{$visit->id}")->assertOk();

        $impresora = collect($response->json('impresoras'))
            ->firstWhere('impresora_id', (string) $printer->id);

        $this->assertNotNull($impresora);
        $this->assertTrue((bool) $impresora['es_color']);
    }
}
