<?php

namespace Tests\Feature;

use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractPrinter;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterHistory;
use App\Models\PrinterModel;
use App\Models\Reading;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Models\Warehouse;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ContractPrinterAliasTest extends TestCase
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

    private function createPrinter(User $user): Printer
    {
        $brand = PrinterBrand::firstOrCreate(
            ['slug' => 'hp'],
            ['nombre' => 'HP']
        );
        $model = PrinterModel::firstOrCreate(
            ['brand_id' => $brand->id, 'nombre' => 'LaserJet Pro M404']
        );

        return Printer::create([
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
        ]);
    }

    private function contractPayload(Client $client, array $printers): array
    {
        return [
            'cliente_id' => $client->id,
            'fecha_inicio' => today()->toDateString(),
            'tarifa_base' => 1500,
            'paginas_incluidas' => 500,
            'costo_pag_excedente' => 0.01,
            'dias_gracia' => 15,
            'frecuencia_visitas' => 'MENSUAL',
            'impresoras' => $printers,
        ];
    }

    private function crearContratoConAdmin(Printer $printer, string $alias): int
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Cliente ' . uniqid());

        $response = $this->postJson('/api/v1/contracts', $this->contractPayload($client, [
            ['id' => $printer->id, 'lectura_inicial' => 0, 'alias' => $alias],
        ]));

        $response->assertCreated();

        return (int) $response->json('id');
    }

    public function test_crea_contrato_con_alias_y_resource_lo_expone(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Alias SA');
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);

        $response = $this->postJson('/api/v1/contracts', $this->contractPayload($client, [
            ['id' => $p1->id, 'lectura_inicial' => 100, 'alias' => 'Recepción'],
            ['id' => $p2->id, 'lectura_inicial' => 200, 'alias' => 'Contabilidad'],
        ]));

        $response->assertCreated();
        $contractId = (int) $response->json('id');

        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p1->id,
            'alias' => 'Recepción',
            'activa' => true,
        ]);
        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p2->id,
            'alias' => 'Contabilidad',
        ]);

        $show = $this->getJson("/api/v1/contracts/{$contractId}")->assertOk();
        $aliases = collect($show->json('impresoras'))->pluck('alias', 'impresora_id');
        $this->assertSame('Recepción', $aliases[$p1->id]);
        $this->assertSame('Contabilidad', $aliases[$p2->id]);

        $evento = PrinterHistory::where('impresora_id', $p1->id)
            ->where('tipo_evento', 'ASIGNACION_CONTRATO')
            ->first();
        $this->assertSame('Recepción', $evento->datos_adicionales['alias'] ?? null);
    }

    public function test_alias_duplicado_en_asignaciones_del_mismo_contrato_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Duplicado SA');
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);

        // Pre-check en el wizard: la transaccion revierte todo.
        $this->postJson('/api/v1/contracts', $this->contractPayload($client, [
            ['id' => $p1->id, 'lectura_inicial' => 0, 'alias' => 'Recepción'],
            ['id' => $p2->id, 'lectura_inicial' => 0, 'alias' => 'Recepción'],
        ]))->assertStatus(422);

        $this->assertDatabaseCount('contracts', 0);

        // Pre-check en assign-printer sobre un contrato existente.
        $contractId = $this->crearContratoConAdmin($p1, 'Recepción');

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 0,
            'alias' => 'Recepción',
        ])->assertStatus(422);

        $this->assertDatabaseHas('printers', ['id' => $p2->id, 'estado' => PrinterStatus::EN_ALMACEN->value]);
        $this->assertDatabaseMissing('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p2->id,
        ]);
    }

    public function test_indice_parcial_rechaza_alias_duplicado_activo_a_nivel_bd(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin($p1, 'Recepción');

        // Sin pasar por el servicio: el indice parcial es el backstop real.
        $this->expectException(UniqueConstraintViolationException::class);

        DB::table('contract_printer')->insert([
            'contrato_id' => $contractId,
            'impresora_id' => $p2->id,
            'fecha_asignacion' => today(),
            'lectura_inicial' => 0,
            'alias' => 'Recepción',
            'activa' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_mismo_alias_en_contratos_distintos_es_valido(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);

        $this->crearContratoConAdmin($p1, 'Recepción');

        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Otro Cliente SA');
        $this->postJson('/api/v1/contracts', $this->contractPayload($client, [
            ['id' => $p2->id, 'lectura_inicial' => 0, 'alias' => 'Recepción'],
        ]))->assertCreated();

        $this->assertSame(2, ContractPrinter::where('alias', 'Recepción')->count());
    }

    public function test_liberar_y_reasignar_con_mismo_alias_es_valido(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin($p1, 'Recepción');

        Sanctum::actingAs($admin);
        $warehouse = Warehouse::create([
            'nombre' => 'Almacén Central',
            'direccion' => 'Calle Falsa 123',
        ]);

        $this->postJson("/api/v1/contracts/{$contractId}/release-printer", [
            'impresora_id' => $p1->id,
            'almacen_destino_id' => $warehouse->id,
        ])->assertOk();

        // La fila liberada conserva el alias como evidencia historica.
        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p1->id,
            'alias' => 'Recepción',
            'activa' => false,
        ]);

        // La nueva impresora puede heredar el mismo alias.
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 0,
            'alias' => 'Recepción',
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p2->id,
            'alias' => 'Recepción',
            'activa' => true,
        ]);

        $liberacion = PrinterHistory::where('impresora_id', $p1->id)
            ->where('tipo_evento', 'LIBERACION_CONTRATO')
            ->first();
        $this->assertSame('Recepción', $liberacion->datos_adicionales['alias'] ?? null);
    }

    public function test_patch_renombra_alias_de_asignacion_activa(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin($p1, 'Recepción');

        $assignment = ContractPrinter::where('contrato_id', $contractId)
            ->where('activa', true)
            ->first();

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/contracts/{$contractId}/assignments/{$assignment->id}", [
            'alias' => 'Taller',
        ])
            ->assertOk()
            ->assertJsonPath('id', $contractId);

        $this->assertDatabaseHas('contract_printer', [
            'id' => $assignment->id,
            'alias' => 'Taller',
        ]);
    }

    public function test_patch_sobre_asignacion_inactiva_es_rechazado(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin($p1, 'Recepción');

        Sanctum::actingAs($admin);
        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);
        $this->postJson("/api/v1/contracts/{$contractId}/release-printer", [
            'impresora_id' => $p1->id,
            'almacen_destino_id' => $warehouse->id,
        ])->assertOk();

        $assignment = ContractPrinter::where('contrato_id', $contractId)
            ->where('activa', false)
            ->first();

        $this->patchJson("/api/v1/contracts/{$contractId}/assignments/{$assignment->id}", [
            'alias' => 'Taller',
        ])->assertStatus(422);
    }

    public function test_patch_con_alias_duplicado_es_rechazado(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin($p1, 'Recepción');

        $p2 = $this->createPrinter($admin);
        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 0,
            'alias' => 'Contabilidad',
        ])->assertOk();

        $assignmentP2 = ContractPrinter::where('contrato_id', $contractId)
            ->where('impresora_id', $p2->id)
            ->first();

        $this->patchJson("/api/v1/contracts/{$contractId}/assignments/{$assignmentP2->id}", [
            'alias' => 'Recepción',
        ])->assertStatus(422);
    }

    public function test_patch_con_alias_null_limpia_el_alias(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin($p1, 'Recepción');

        $assignment = ContractPrinter::where('contrato_id', $contractId)
            ->where('activa', true)
            ->first();

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/contracts/{$contractId}/assignments/{$assignment->id}", [
            'alias' => null,
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'id' => $assignment->id,
            'alias' => null,
        ]);
    }

    public function test_lectura_de_impresora_con_alias_muestra_el_alias_como_nombre(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin($p1, 'Recepción');

        $visit = Visit::create([
            'cliente_id' => Contract::find($contractId)->cliente_id,
            'contrato_id' => $contractId,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => today(),
            'socio_id' => $admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $reading = Reading::create([
            'visita_id' => $visit->id,
            'impresora_id' => $p1->id,
            'contrato_id' => $contractId,
            'fecha' => today(),
            'valor_contador' => 500,
            'paginas_periodo' => 100,
            'socio_id' => $admin->id,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        Sanctum::actingAs($admin);
        $this->getJson("/api/v1/readings/{$reading->id}")
            ->assertOk()
            ->assertJsonPath('impresora_nombre', 'Recepción')
            ->assertJsonPath('impresora_alias', 'Recepción');
    }
}
