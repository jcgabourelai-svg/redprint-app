<?php

namespace Tests\Feature;

use App\Enums\ArticleType;
use App\Enums\ContractStatus;
use App\Enums\FieldRecordStatus;
use App\Enums\FieldRecordType;
use App\Enums\PrinterStatus;
use App\Enums\VisitFrequency;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Article;
use App\Models\Client;
use App\Models\Contract;
use App\Models\FieldRecord;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterHistory;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FieldRecordTest extends TestCase
{
    use RefreshDatabase;

    private function adminUser(): User
    {
        $role = Role::create([
            'nombre' => 'Admin Test',
            'slug' => 'admin-test',
            'es_sistema' => true,
        ]);

        return User::create([
            'nombre' => 'Admin Test',
            'correo' => 'admin@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0100',
            'rol_id' => $role->id,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function userWithPermissions(array $claves): User
    {
        $role = Role::create([
            'nombre' => 'Rol Test ' . uniqid(),
            'slug' => 'rol-test-' . uniqid(),
            'es_sistema' => false,
        ]);
        $role->permissions()->sync(Permission::whereIn('clave', $claves)->pluck('id'));

        return User::create([
            'nombre' => 'Operador Test',
            'correo' => 'operador-' . uniqid() . '@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0199',
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

    private function createContract(Client $client, User $user, array $overrides = []): Contract
    {
        return Contract::create(array_merge([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today(),
            'tarifa_base' => 1500,
            'paginas_incluidas' => 500,
            'costo_pag_excedente' => 0.01,
            'dias_gracia' => 15,
            'frecuencia_visitas' => VisitFrequency::MENSUAL,
            'dias_adelanto' => 7,
            'estado' => ContractStatus::ACTIVO,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    private function createPrinter(User $user, array $overrides = []): Printer
    {
        $brand = PrinterBrand::firstOrCreate(
            ['slug' => 'hp'],
            ['nombre' => 'HP']
        );
        $model = PrinterModel::firstOrCreate(
            ['brand_id' => $brand->id, 'nombre' => 'LaserJet Pro M404'],
        );

        return Printer::create(array_merge([
            'marca' => 'HP',
            'modelo' => 'LaserJet Pro M404',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'EQ-' . uniqid(),
            'estado' => PrinterStatus::EN_ALMACEN,
            'contador_actual' => 0,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    /**
     * Adjunta la impresora al contrato como pivote activa (simula una
     * instalacion previa) y la marca RENTADA.
     */
    private function attachActivePrinter(Contract $contract, Printer $printer, int $lecturaInicial): void
    {
        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => now(),
            'lectura_inicial' => $lecturaInicial,
            'activa' => true,
        ]);
        $printer->update(['estado' => PrinterStatus::RENTADA]);
    }

    private function createFieldRecord(User $socio, FieldRecordType $tipo, array $overrides = []): FieldRecord
    {
        return FieldRecord::create(array_merge([
            'tipo' => $tipo,
            'estado' => FieldRecordStatus::PENDIENTE,
            'nombre_cliente_reportado' => 'Cliente Reportado SA',
            'valor_contador' => $tipo === FieldRecordType::LECTURA ? 1500 : null,
            'capturado_en' => now()->subDays(1),
            'socio_id' => $socio->id,
            'creado_por' => $socio->id,
        ], $overrides));
    }

    /**
     * Visita programada "de scheduler" (sin origen CAMPO) para el contrato.
     */
    private function createPendingVisit(Contract $contract, User $socio, array $overrides = []): Visit
    {
        return Visit::create(array_merge([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => VisitType::LECTURA,
            'fecha_programada' => today(),
            'socio_id' => $socio->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $socio->id,
            'fecha_creacion' => now()->subDays(7),
        ], $overrides));
    }

    private function storePayload(array $overrides = []): array
    {
        return array_merge([
            'tipo' => 'LECTURA',
            'nombre_cliente_reportado' => 'Tacos El Güero',
            'num_serie_reportado' => 'VNC4G05567',
            'valor_contador' => 12345,
            'capturado_en' => now()->toIso8601String(),
        ], $overrides);
    }

    public function test_store_crea_registro_pendiente_con_socio_autenticado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/field-records', $this->storePayload([
            'client_uuid' => '11111111-1111-4111-8111-111111111111',
        ]));

        $response->assertCreated()
            ->assertJsonPath('estado', 'PENDIENTE')
            ->assertJsonPath('socio_id', $admin->id)
            ->assertJsonPath('nombre_cliente_reportado', 'Tacos El Güero');

        $this->assertDatabaseHas('field_records', [
            'client_uuid' => '11111111-1111-4111-8111-111111111111',
            'estado' => FieldRecordStatus::PENDIENTE->value,
            'socio_id' => $admin->id,
            'creado_por' => $admin->id,
        ]);
    }

    public function test_store_lectura_sin_valor_contador_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/field-records', $this->storePayload([
            'valor_contador' => null,
        ]));

        $response->assertStatus(422)->assertJsonValidationErrors(['valor_contador']);
        $this->assertDatabaseCount('field_records', 0);
    }

    public function test_store_es_idempotente_por_client_uuid(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $uuid = '22222222-2222-4222-8222-222222222222';
        $payload = $this->storePayload(['client_uuid' => $uuid]);

        $first = $this->postJson('/api/v1/field-records', $payload);
        $first->assertCreated();

        // Reintento de sync ambiguo: mismo client_uuid no duplica
        $second = $this->postJson('/api/v1/field-records', $payload);
        $second->assertOk()
            ->assertJsonPath('id', $first->json('id'));

        $this->assertDatabaseCount('field_records', 1);
    }

    public function test_sin_permiso_recibe_403(): void
    {
        $sinPermiso = $this->userWithPermissions(['inventario.articulos']);
        Sanctum::actingAs($sinPermiso);

        $record = $this->createFieldRecord($sinPermiso, FieldRecordType::LECTURA);

        $this->getJson('/api/v1/field-records')->assertStatus(403);
        $this->postJson('/api/v1/field-records', $this->storePayload())->assertStatus(403);
        $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => 1,
            'contrato_id' => 1,
        ])->assertStatus(403);
    }

    public function test_link_lectura_con_impresora_en_contrato_crea_visita_y_lectura(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Cliente Campo SA');
        $contract = $this->createContract($client, $admin);
        $printer = $this->createPrinter($admin);
        $this->attachActivePrinter($contract, $printer, 1000);

        $record = $this->createFieldRecord($admin, FieldRecordType::LECTURA, [
            'valor_contador' => 1500,
            'socio_id' => $admin->id,
        ]);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
        ]);

        $response->assertOk()
            ->assertJsonPath('estado', 'VINCULADO')
            ->assertJsonPath('cliente_id', $client->id)
            ->assertJsonPath('contrato_id', $contract->id)
            ->assertJsonPath('impresora_id', $printer->id);

        $visitaId = $response->json('visita_id');
        $this->assertDatabaseHas('visits', [
            'id' => $visitaId,
            'origen' => 'CAMPO',
            'tipo_visita' => 'LECTURA',
            'contrato_id' => $contract->id,
            'socio_id' => $admin->id,
            'creado_por' => $admin->id,
        ]);

        $lecturaId = $response->json('lectura_id');
        $this->assertDatabaseHas('readings', [
            'id' => $lecturaId,
            'visita_id' => $visitaId,
            'impresora_id' => $printer->id,
            'valor_contador' => 1500,
            'paginas_periodo' => 500,
            'es_anomalia' => false,
            'socio_id' => $admin->id,
            'creado_por' => $admin->id,
        ]);

        $this->assertDatabaseHas('field_records', [
            'id' => $record->id,
            'estado' => FieldRecordStatus::VINCULADO->value,
            'visita_id' => $visitaId,
            'lectura_id' => $lecturaId,
            'vinculado_por' => $admin->id,
        ]);

        // Stock intacto: un registro LECTURA no toca inventario
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertDatabaseCount('article_deliveries', 0);
    }

    public function test_link_lectura_con_impresora_en_almacen_instala_implicitamente(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Cliente Almacén SA');
        $contract = $this->createContract($client, $admin);
        $printer = $this->createPrinter($admin, ['estado' => PrinterStatus::EN_ALMACEN]);

        $record = $this->createFieldRecord($admin, FieldRecordType::LECTURA, [
            'valor_contador' => 12345,
        ]);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
        ]);

        $response->assertOk();

        // Instalación implícita: lectura_inicial = contador capturado
        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
            'activa' => true,
            'lectura_inicial' => 12345,
        ]);
        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => PrinterStatus::RENTADA->value,
        ]);

        // Linea base: paginas_periodo = 0
        $this->assertDatabaseHas('readings', [
            'id' => $response->json('lectura_id'),
            'valor_contador' => 12345,
            'paginas_periodo' => 0,
        ]);

        // El evento de instalacion queda vinculado a la visita
        $this->assertDatabaseHas('printer_histories', [
            'impresora_id' => $printer->id,
            'tipo_evento' => 'ASIGNACION_CONTRATO',
        ]);
        $history = PrinterHistory::where('impresora_id', $printer->id)
            ->where('tipo_evento', 'ASIGNACION_CONTRATO')
            ->first();
        $this->assertEquals($response->json('visita_id'), $history->datos_adicionales['visita_id']);

        $this->assertDatabaseHas('visits', [
            'id' => $response->json('visita_id'),
            'estado' => VisitStatus::COMPLETADA->value,
        ]);
    }

    public function test_link_lectura_con_retroceso_exige_justificacion(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Cliente Retroceso SA');
        $contract = $this->createContract($client, $admin);
        $printer = $this->createPrinter($admin);
        $this->attachActivePrinter($contract, $printer, 2000);

        $record = $this->createFieldRecord($admin, FieldRecordType::LECTURA, [
            'valor_contador' => 1500,
        ]);

        $payload = [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
        ];

        // Sin justificacion: el server rechaza
        $this->postJson("/api/v1/field-records/{$record->id}/link", $payload)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Lectura anomala requiere justificacion');
        $this->assertDatabaseHas('field_records', ['id' => $record->id, 'estado' => FieldRecordStatus::PENDIENTE->value]);

        // Con justificacion: anomalia registrada
        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", $payload + [
            'justificacion_anomalia' => 'Se cambió el tambor y se reinició el contador',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('readings', [
            'id' => $response->json('lectura_id'),
            'valor_contador' => 1500,
            'paginas_periodo' => 0,
            'es_anomalia' => true,
        ]);
        $this->assertDatabaseHas('field_records', [
            'id' => $record->id,
            'estado' => FieldRecordStatus::VINCULADO->value,
        ]);
    }

    public function test_link_lectura_con_impresora_rentada_en_otro_contrato_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $clientA = $this->createClient($admin, 'Cliente A SA');
        $clientB = $this->createClient($admin, 'Cliente B SA');
        $contractA = $this->createContract($clientA, $admin);
        $contractB = $this->createContract($clientB, $admin);
        $printer = $this->createPrinter($admin);
        $this->attachActivePrinter($contractB, $printer, 500);

        $record = $this->createFieldRecord($admin, FieldRecordType::LECTURA);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $clientA->id,
            'contrato_id' => $contractA->id,
            'impresora_id' => $printer->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', "La impresora {$printer->num_serie} está RENTADA y no pertenece al contrato. Libérala o corrige su estado en el catálogo antes de vincular.");

        $this->assertDatabaseHas('field_records', ['id' => $record->id, 'estado' => FieldRecordStatus::PENDIENTE->value]);
        $this->assertDatabaseMissing('readings', ['impresora_id' => $printer->id]);
    }

    public function test_link_entrega_registra_salidas_de_stock(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Cliente Entrega SA');
        $contract = $this->createContract($client, $admin);

        $toner = Article::create([
            'tipo_articulo' => ArticleType::CONSUMIBLE,
            'subtipo' => 'TONER',
            'nombre' => 'Tóner 85A',
            'marca' => 'HP',
            'modelo_sku' => '85A',
            'stock_actual' => 10,
            'umbral_reposicion' => 2,
            'costo_unitario' => 50.00,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
        $tambor = Article::create([
            'tipo_articulo' => ArticleType::CONSUMIBLE,
            'subtipo' => 'TAMBOR',
            'nombre' => 'Tambor DR-730',
            'marca' => 'Brother',
            'modelo_sku' => 'DR-730',
            'stock_actual' => 10,
            'umbral_reposicion' => 2,
            'costo_unitario' => 80.00,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        $record = $this->createFieldRecord($admin, FieldRecordType::ENTREGA_INSUMOS, [
            'articulos_entregados' => [
                ['descripcion' => 'Tóner negro', 'cantidad' => 2],
                ['descripcion' => 'Tambor', 'cantidad' => 1],
            ],
        ]);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'articulos' => [
                ['articulo_id' => $toner->id, 'cantidad' => 2],
                ['articulo_id' => $tambor->id, 'cantidad' => 3],
            ],
        ]);

        $response->assertOk()->assertJsonPath('estado', 'VINCULADO');

        $visitaId = $response->json('visita_id');
        $this->assertDatabaseCount('article_deliveries', 2);
        $this->assertDatabaseHas('article_deliveries', [
            'visita_id' => $visitaId,
            'articulo_id' => $toner->id,
            'cantidad' => 2,
        ]);

        $this->assertEquals(8, $toner->fresh()->stock_actual);
        $this->assertEquals(7, $tambor->fresh()->stock_actual);

        $salidas = DB::table('inventory_movements')
            ->where('tipo_movimiento', 'SALIDA')
            ->whereIn('articulo_id', [$toner->id, $tambor->id])
            ->count();
        $this->assertEquals(2, $salidas);

        $this->assertDatabaseHas('visits', [
            'id' => $visitaId,
            'tipo_visita' => 'ENTREGA_INSUMOS',
            'estado' => VisitStatus::COMPLETADA->value,
        ]);
    }

    public function test_link_reutiliza_visita_pendiente_de_la_misma_fecha(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $socio = $this->userWithPermissions([]);

        $client = $this->createClient($admin, 'Cliente Reutiliza SA');
        $contract = $this->createContract($client, $admin);
        $printer = $this->createPrinter($admin);
        $this->attachActivePrinter($contract, $printer, 1000);

        $record = $this->createFieldRecord($socio, FieldRecordType::LECTURA, [
            'valor_contador' => 1500,
            'notas' => 'Cliente reportó ruido en la impresora',
        ]);

        // Visita programada por el scheduler ese mismo dia, con otro socio
        $visit = $this->createPendingVisit($contract, $admin, [
            'fecha_programada' => $record->capturado_en->toDateString(),
            'notas' => 'Visita programada por el scheduler',
        ]);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
        ]);

        $response->assertOk()->assertJsonPath('visita_id', $visit->id);

        // La visita programada fue reutilizada, no duplicada
        $this->assertDatabaseCount('visits', 1);
        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::COMPLETADA->value,
            'origen' => null,
            'tipo_visita' => 'LECTURA',
            'socio_id' => $socio->id,
        ]);

        $notas = Visit::find($visit->id)->notas;
        $this->assertStringContainsString('Visita programada por el scheduler', $notas);
        $this->assertStringContainsString('Cliente reportó ruido en la impresora', $notas);
        $this->assertStringContainsString("Regularizada desde registro de campo #{$record->id}", $notas);

        $this->assertDatabaseHas('readings', [
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'valor_contador' => 1500,
            'socio_id' => $socio->id,
        ]);
        $this->assertDatabaseHas('field_records', [
            'id' => $record->id,
            'estado' => FieldRecordStatus::VINCULADO->value,
            'visita_id' => $visit->id,
            'lectura_id' => $response->json('lectura_id'),
        ]);
    }

    public function test_link_crea_visita_cuando_la_pendiente_es_de_otra_fecha(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Cliente Otra Fecha SA');
        $contract = $this->createContract($client, $admin);
        $printer = $this->createPrinter($admin);
        $this->attachActivePrinter($contract, $printer, 1000);

        $record = $this->createFieldRecord($admin, FieldRecordType::LECTURA, [
            'valor_contador' => 1500,
        ]);

        $visit = $this->createPendingVisit($contract, $admin, [
            'fecha_programada' => today()->addDays(5)->toDateString(),
        ]);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
        ]);

        $response->assertOk();
        $this->assertNotEquals($visit->id, $response->json('visita_id'));

        // La programada de otra fecha queda PENDIENTE; la nueva es CAMPO COMPLETADA
        $this->assertDatabaseCount('visits', 2);
        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::PENDIENTE->value,
        ]);
        $this->assertDatabaseHas('visits', [
            'id' => $response->json('visita_id'),
            'origen' => 'CAMPO',
            'estado' => VisitStatus::COMPLETADA->value,
        ]);
    }

    public function test_link_entrega_reutiliza_visita_pendiente(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $socio = $this->userWithPermissions([]);

        $client = $this->createClient($admin, 'Cliente Entrega Reutiliza SA');
        $contract = $this->createContract($client, $admin);

        $toner = Article::create([
            'tipo_articulo' => ArticleType::CONSUMIBLE,
            'subtipo' => 'TONER',
            'nombre' => 'Tóner 85A',
            'marca' => 'HP',
            'modelo_sku' => '85A',
            'stock_actual' => 10,
            'umbral_reposicion' => 2,
            'costo_unitario' => 50.00,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        $record = $this->createFieldRecord($socio, FieldRecordType::ENTREGA_INSUMOS, [
            'articulos_entregados' => [
                ['descripcion' => 'Tóner negro', 'cantidad' => 2],
            ],
        ]);

        // Aunque la programada es LECTURA, la entrega la reutiliza
        $visit = $this->createPendingVisit($contract, $admin, [
            'tipo_visita' => VisitType::LECTURA,
            'fecha_programada' => $record->capturado_en->toDateString(),
        ]);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'articulos' => [
                ['articulo_id' => $toner->id, 'cantidad' => 2],
            ],
        ]);

        $response->assertOk()->assertJsonPath('visita_id', $visit->id);

        // 1 sola visita: tipo/origen de la programada intactos, ya COMPLETADA
        $this->assertDatabaseCount('visits', 1);
        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'tipo_visita' => 'LECTURA',
            'origen' => null,
            'estado' => VisitStatus::COMPLETADA->value,
            'socio_id' => $socio->id,
        ]);

        $this->assertDatabaseHas('article_deliveries', [
            'visita_id' => $visit->id,
            'articulo_id' => $toner->id,
            'cantidad' => 2,
        ]);
        $this->assertEquals(8, $toner->fresh()->stock_actual);

        $salidas = DB::table('inventory_movements')
            ->where('tipo_movimiento', 'SALIDA')
            ->where('articulo_id', $toner->id)
            ->count();
        $this->assertEquals(1, $salidas);
    }

    public function test_link_otro_no_reutiliza_visita_pendiente(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Cliente Otro No Reutiliza SA');
        $contract = $this->createContract($client, $admin);

        $record = $this->createFieldRecord($admin, FieldRecordType::OTRO);

        $visit = $this->createPendingVisit($contract, $admin, [
            'fecha_programada' => $record->capturado_en->toDateString(),
        ]);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'MANTENIMIENTO',
            'motivo_cierre' => 'Limpieza preventiva no programada',
        ]);

        $response->assertOk();
        $this->assertNotEquals($visit->id, $response->json('visita_id'));

        // OTRO siempre crea visita nueva; la programada queda PENDIENTE
        $this->assertDatabaseCount('visits', 2);
        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::PENDIENTE->value,
        ]);
        $this->assertDatabaseHas('visits', [
            'id' => $response->json('visita_id'),
            'tipo_visita' => 'MANTENIMIENTO',
            'origen' => 'CAMPO',
            'estado' => VisitStatus::COMPLETADA->value,
        ]);
    }

    public function test_link_prefiere_visita_lectura_si_hay_dos_pendientes_el_mismo_dia(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Cliente Preferencia SA');
        $contract = $this->createContract($client, $admin);
        $printer = $this->createPrinter($admin);
        $this->attachActivePrinter($contract, $printer, 1000);

        $record = $this->createFieldRecord($admin, FieldRecordType::LECTURA, [
            'valor_contador' => 1500,
        ]);

        // La INSTALACION tiene id menor: sin preferencia seria la elegida
        $instalacion = $this->createPendingVisit($contract, $admin, [
            'tipo_visita' => VisitType::INSTALACION,
            'fecha_programada' => $record->capturado_en->toDateString(),
        ]);
        $lectura = $this->createPendingVisit($contract, $admin, [
            'tipo_visita' => VisitType::LECTURA,
            'fecha_programada' => $record->capturado_en->toDateString(),
        ]);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
        ]);

        $response->assertOk()->assertJsonPath('visita_id', $lectura->id);

        $this->assertDatabaseCount('visits', 2);
        $this->assertDatabaseHas('visits', [
            'id' => $lectura->id,
            'estado' => VisitStatus::COMPLETADA->value,
        ]);
        $this->assertDatabaseHas('visits', [
            'id' => $instalacion->id,
            'estado' => VisitStatus::PENDIENTE->value,
        ]);
    }

    public function test_link_dos_veces_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Cliente Inmutabilidad SA');
        $contract = $this->createContract($client, $admin);
        $printer = $this->createPrinter($admin);
        $this->attachActivePrinter($contract, $printer, 1000);

        $record = $this->createFieldRecord($admin, FieldRecordType::LECTURA);

        $payload = [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'impresora_id' => $printer->id,
        ];

        $this->postJson("/api/v1/field-records/{$record->id}/link", $payload)->assertOk();
        $this->postJson("/api/v1/field-records/{$record->id}/link", $payload)
            ->assertStatus(422)
            ->assertJsonPath('message', 'El registro ya fue regularizado y es inmutable');

        // No se duplico nada
        $this->assertDatabaseCount('visits', 1);
        $this->assertDatabaseCount('readings', 1);
    }

    public function test_discartar_exige_motivo_y_marca_descartado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $record = $this->createFieldRecord($admin, FieldRecordType::OTRO);

        $this->postJson("/api/v1/field-records/{$record->id}/discard", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['motivo_descarte']);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/discard", [
            'motivo_descarte' => 'Era una visita de cortesía sin operación',
        ]);

        $response->assertOk()->assertJsonPath('estado', 'DESCARTADO');
        $this->assertDatabaseHas('field_records', [
            'id' => $record->id,
            'estado' => FieldRecordStatus::DESCARTADO->value,
            'motivo_descarte' => 'Era una visita de cortesía sin operación',
            'vinculado_por' => $admin->id,
        ]);
    }

    public function test_link_otro_crea_visita_completada_con_motivo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Cliente Otro SA');
        $contract = $this->createContract($client, $admin);

        $record = $this->createFieldRecord($admin, FieldRecordType::OTRO, [
            'notas' => 'Se detectó falla eléctrica en el sitio',
        ]);

        $response = $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'MANTENIMIENTO',
            'motivo_cierre' => 'Sitio sin energía, no se pudo operar',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('visits', [
            'id' => $response->json('visita_id'),
            'tipo_visita' => 'MANTENIMIENTO',
            'origen' => 'CAMPO',
            'estado' => VisitStatus::COMPLETADA->value,
            'motivo_cierre' => 'Sitio sin energía, no se pudo operar',
        ]);
        $this->assertDatabaseHas('field_records', [
            'id' => $record->id,
            'estado' => FieldRecordStatus::VINCULADO->value,
            'lectura_id' => null,
            'impresora_id' => null,
        ]);
    }

    public function test_link_rechaza_contrato_de_otro_cliente_o_no_activo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $clientA = $this->createClient($admin, 'Cliente Real SA');
        $clientB = $this->createClient($admin, 'Cliente Otro SA');
        $contractA = $this->createContract($clientA, $admin);
        $this->createContract($clientB, $admin);

        $record = $this->createFieldRecord($admin, FieldRecordType::OTRO);

        // Contrato de otro cliente
        $contratoB = Contract::where('cliente_id', $clientB->id)->first();
        $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $clientA->id,
            'contrato_id' => $contratoB->id,
            'tipo_visita' => 'MANTENIMIENTO',
            'motivo_cierre' => 'x',
        ])->assertStatus(422)
            ->assertJsonPath('message', 'El contrato no pertenece al cliente seleccionado');

        // Contrato no ACTIVO
        $contractA->update(['estado' => ContractStatus::SUSPENDIDO]);
        $this->postJson("/api/v1/field-records/{$record->id}/link", [
            'cliente_id' => $clientA->id,
            'contrato_id' => $contractA->id,
            'tipo_visita' => 'MANTENIMIENTO',
            'motivo_cierre' => 'x',
        ])->assertStatus(422)
            ->assertJsonPath('message', "El contrato {$contractA->codigo_negocio} no está activo (estado: SUSPENDIDO). Actívalo antes de vincular el registro.");

        $this->assertDatabaseHas('field_records', ['id' => $record->id, 'estado' => FieldRecordStatus::PENDIENTE->value]);
        $this->assertDatabaseCount('visits', 0);
    }
}
