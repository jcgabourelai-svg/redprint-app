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
use App\Support\PrinterColorPalette;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ContractPrinterColorTest extends TestCase
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

    private function crearContratoConAdmin(array $printers): int
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Cliente ' . uniqid());

        $response = $this->postJson('/api/v1/contracts', $this->contractPayload($client, $printers));

        $response->assertCreated();

        return (int) $response->json('id');
    }

    public function test_asigna_paleta_en_orden_por_impresora(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $client = $this->createClient($admin, 'Colores SA');
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);

        $response = $this->postJson('/api/v1/contracts', $this->contractPayload($client, [
            ['id' => $p1->id, 'lectura_inicial' => 100],
            ['id' => $p2->id, 'lectura_inicial' => 200],
        ]));

        $response->assertCreated();
        $contractId = (int) $response->json('id');

        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p1->id,
            'color' => 'azul',
            'activa' => true,
        ]);
        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p2->id,
            'color' => 'turquesa',
        ]);

        $show = $this->getJson("/api/v1/contracts/{$contractId}")->assertOk();
        $colores = collect($show->json('impresoras'))->pluck('color', 'impresora_id');
        $this->assertSame('azul', $colores[$p1->id]);
        $this->assertSame('turquesa', $colores[$p2->id]);
    }

    public function test_tercera_asignacion_toma_verde_y_liberada_devuelve_el_primer_libre(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $p3 = $this->createPrinter($admin);

        $contractId = $this->crearContratoConAdmin([
            ['id' => $p1->id, 'lectura_inicial' => 0],
            ['id' => $p2->id, 'lectura_inicial' => 0],
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $p3->id,
            'lectura_inicial' => 0,
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p3->id,
            'color' => 'verde',
            'activa' => true,
        ]);

        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);
        $this->postJson("/api/v1/contracts/{$contractId}/release-printer", [
            'impresora_id' => $p1->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'ROTACION',
            'justificacion_sin_lectura' => 'Rotación de flota',
        ])->assertOk();

        // La fila liberada conserva su color como evidencia historica.
        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p1->id,
            'color' => 'azul',
            'activa' => false,
        ]);

        $p4 = $this->createPrinter($admin);
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $p4->id,
            'lectura_inicial' => 0,
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p4->id,
            'color' => 'azul',
            'activa' => true,
        ]);
    }

    public function test_color_heredado_se_respeta_si_esta_libre(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin([
            ['id' => $p1->id, 'lectura_inicial' => 0],
        ]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 0,
            'color' => 'morado',
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p2->id,
            'color' => 'morado',
            'activa' => true,
        ]);
    }

    public function test_color_ocupado_cae_al_primer_libre_sin_error(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin([
            ['id' => $p1->id, 'lectura_inicial' => 0],
        ]);

        Sanctum::actingAs($admin);
        // 'azul' ya lo usa p1: fallback a 'turquesa' (primer libre), no 422.
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 0,
            'color' => 'azul',
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p2->id,
            'color' => 'turquesa',
            'activa' => true,
        ]);
    }

    public function test_color_con_key_invalida_es_rechazado(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin([
            ['id' => $p1->id, 'lectura_inicial' => 0],
        ]);

        $p2 = $this->createPrinter($admin);
        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/contracts/{$contractId}/assign-printer", [
            'impresora_id' => $p2->id,
            'lectura_inicial' => 0,
            'color' => 'fucsia',
        ])->assertStatus(422);

        $this->assertDatabaseHas('printers', ['id' => $p2->id, 'estado' => PrinterStatus::EN_ALMACEN->value]);
        $this->assertDatabaseMissing('contract_printer', [
            'contrato_id' => $contractId,
            'impresora_id' => $p2->id,
        ]);
    }

    public function test_eventos_congelan_el_color_en_datos_adicionales(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin([
            ['id' => $p1->id, 'lectura_inicial' => 0],
        ]);

        $asignacion = PrinterHistory::where('impresora_id', $p1->id)
            ->where('tipo_evento', 'ASIGNACION_CONTRATO')
            ->first();
        $this->assertSame('azul', $asignacion->datos_adicionales['color'] ?? null);

        Sanctum::actingAs($admin);
        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);
        $this->postJson("/api/v1/contracts/{$contractId}/release-printer", [
            'impresora_id' => $p1->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'ROTACION',
            'justificacion_sin_lectura' => 'Rotación de flota',
        ])->assertOk();

        $liberacion = PrinterHistory::where('impresora_id', $p1->id)
            ->where('tipo_evento', 'LIBERACION_CONTRATO')
            ->first();
        $this->assertSame('azul', $liberacion->datos_adicionales['color'] ?? null);
    }

    public function test_mas_de_ocho_activas_reutiliza_por_modulo(): void
    {
        $admin = $this->adminUser();
        $printers = [];
        for ($i = 0; $i < 9; $i++) {
            $printers[] = $this->createPrinter($admin);
        }

        $payloadPrinters = array_map(
            fn (Printer $p) => ['id' => $p->id, 'lectura_inicial' => 0],
            $printers
        );

        $contractId = $this->crearContratoConAdmin($payloadPrinters);

        $colores = ContractPrinter::where('contrato_id', $contractId)
            ->where('activa', true)
            ->orderBy('id')
            ->pluck('color');

        $this->assertSame(PrinterColorPalette::KEYS, $colores->take(8)->values()->all());
        $this->assertSame('azul', $colores[8]);
    }

    public function test_patch_de_alias_no_altera_el_color(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin([
            ['id' => $p1->id, 'lectura_inicial' => 0, 'alias' => 'Recepción'],
        ]);

        $assignment = ContractPrinter::where('contrato_id', $contractId)
            ->where('activa', true)
            ->first();

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/contracts/{$contractId}/assignments/{$assignment->id}", [
            'alias' => 'Taller',
        ])->assertOk();

        $this->assertDatabaseHas('contract_printer', [
            'id' => $assignment->id,
            'alias' => 'Taller',
            'color' => 'azul',
        ]);
    }

    public function test_lectura_expone_impresora_color(): void
    {
        $admin = $this->adminUser();
        $p1 = $this->createPrinter($admin);
        $contractId = $this->crearContratoConAdmin([
            ['id' => $p1->id, 'lectura_inicial' => 0, 'alias' => 'Recepción'],
        ]);

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
            ->assertJsonPath('impresora_color', 'azul');
    }
}
