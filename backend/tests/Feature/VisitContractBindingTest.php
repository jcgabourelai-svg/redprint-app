<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\VisitFrequency;
use App\Enums\VisitStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VisitContractBindingTest extends TestCase
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
            'estado' => \App\Enums\PrinterStatus::EN_ALMACEN,
            'contador_actual' => 0,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function attachPrinter(Contract $contract, Printer $printer, array $pivot = []): void
    {
        $contract->printers()->attach($printer->id, array_merge([
            'fecha_asignacion' => today(),
            'lectura_inicial' => 0,
            'activa' => true,
        ], $pivot));
    }

    private function payload(Client $client, string $tipo, array $overrides = []): array
    {
        return array_merge([
            'cliente_id' => $client->id,
            'tipo_visita' => $tipo,
            'fecha_programada' => today()->toDateString(),
            'socio_id' => $this->admin->id,
        ], $overrides);
    }

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->adminUser();
        Sanctum::actingAs($this->admin);
    }

    public function test_lectura_sin_contrato_auto_deriva_unico_contrato_activo(): void
    {
        $client = $this->createClient($this->admin, 'Unico Activo SA');
        $contract = $this->createContract($client, $this->admin);

        $response = $this->postJson('/api/v1/visits', $this->payload($client, 'LECTURA'));

        $response->assertCreated()
            ->assertJsonPath('contrato_id', $contract->id)
            ->assertJsonPath('estado', VisitStatus::PENDIENTE->value);

        $this->assertDatabaseHas('visits', [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'LECTURA',
        ]);
    }

    public function test_varios_contratos_activos_sin_contrato_id_es_rechazado(): void
    {
        $client = $this->createClient($this->admin, 'Varios Activos SA');
        $this->createContract($client, $this->admin);
        $this->createContract($client, $this->admin);

        $response = $this->postJson('/api/v1/visits', $this->payload($client, 'LECTURA'));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['contrato_id'])
            ->assertJsonPath('errors.contrato_id.0', 'El cliente tiene 2 contratos activos, selecciona uno');

        $this->assertDatabaseMissing('visits', ['cliente_id' => $client->id]);
    }

    public function test_sin_contratos_activos_con_tipo_que_requiere_contrato_es_rechazado(): void
    {
        $client = $this->createClient($this->admin, 'Sin Contratos SA');

        $response = $this->postJson('/api/v1/visits', $this->payload($client, 'INSTALACION'));

        $response->assertStatus(422)->assertJsonValidationErrors(['contrato_id']);

        $this->assertDatabaseMissing('visits', ['cliente_id' => $client->id]);
    }

    public function test_contrato_de_otro_cliente_es_rechazado(): void
    {
        $client = $this->createClient($this->admin, 'Cliente A SA');
        $otro = $this->createClient($this->admin, 'Cliente B SA');
        $contratoAjeno = $this->createContract($otro, $this->admin);

        $response = $this->postJson('/api/v1/visits', $this->payload($client, 'LECTURA', [
            'contrato_id' => $contratoAjeno->id,
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['contrato_id'])
            ->assertJsonPath('errors.contrato_id.0', 'El contrato no pertenece al cliente seleccionado');

        $this->assertDatabaseMissing('visits', ['cliente_id' => $client->id]);
    }

    public function test_contrato_finalizado_es_rechazado(): void
    {
        $client = $this->createClient($this->admin, 'Finalizado SA');
        $contract = $this->createContract($client, $this->admin, ['estado' => ContractStatus::FINALIZADO]);

        $response = $this->postJson('/api/v1/visits', $this->payload($client, 'LECTURA', [
            'contrato_id' => $contract->id,
        ]));

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['contrato_id'])
            ->assertJsonPath('errors.contrato_id.0', 'El contrato no está activo');

        $this->assertDatabaseMissing('visits', ['cliente_id' => $client->id]);
    }

    public function test_mantenimiento_sin_contrato_crea_visita_huerfana(): void
    {
        $client = $this->createClient($this->admin, 'Mantenimiento SA');

        $response = $this->postJson('/api/v1/visits', $this->payload($client, 'MANTENIMIENTO'));

        $response->assertCreated()->assertJsonPath('contrato_id', null);

        $this->assertDatabaseHas('visits', [
            'cliente_id' => $client->id,
            'contrato_id' => null,
            'tipo_visita' => 'MANTENIMIENTO',
        ]);
    }

    public function test_index_incluye_impresoras_activas_del_contrato(): void
    {
        $client = $this->createClient($this->admin, 'Index SA');
        $contract = $this->createContract($client, $this->admin);
        $activa = $this->createPrinter($this->admin);
        $liberada = $this->createPrinter($this->admin);
        $this->attachPrinter($contract, $activa, ['alias' => 'Recepción']);
        $this->attachPrinter($contract, $liberada, ['alias' => 'Baja', 'activa' => false]);

        Visit::create([
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => today(),
            'socio_id' => $this->admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $this->admin->id,
            'fecha_creacion' => now(),
        ]);

        $response = $this->getJson('/api/v1/visits');

        $response->assertOk();
        $impresoras = $response->json('data.0.impresoras');
        $this->assertCount(1, $impresoras);
        $this->assertSame((string) $activa->id, $impresoras[0]['impresora_id']);
        $this->assertSame('Recepción', $impresoras[0]['alias']);
    }

    public function test_comando_vincula_visitas_huerfanas_con_execute_y_dry_run_no_modifica(): void
    {
        $client = $this->createClient($this->admin, 'Huérfana SA');
        $contract = $this->createContract($client, $this->admin);

        $visit = Visit::create([
            'cliente_id' => $client->id,
            'contrato_id' => null,
            'tipo_visita' => 'INSTALACION',
            'fecha_programada' => today(),
            'socio_id' => $this->admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $this->admin->id,
            'fecha_creacion' => now(),
        ]);

        // Dry-run: reporta pero no modifica.
        $this->artisan('visits:vincular-contratos-huerfanos')->assertSuccessful();
        $this->assertDatabaseHas('visits', ['id' => $visit->id, 'contrato_id' => null]);

        // Execute: asigna el único contrato activo.
        $this->artisan('visits:vincular-contratos-huerfanos', ['--execute' => true])->assertSuccessful();
        $this->assertDatabaseHas('visits', ['id' => $visit->id, 'contrato_id' => $contract->id]);
    }

    public function test_comando_lista_como_atencion_manual_cuando_hay_varios_contratos(): void
    {
        $client = $this->createClient($this->admin, 'Manual SA');
        $this->createContract($client, $this->admin);
        $this->createContract($client, $this->admin);

        $visit = Visit::create([
            'cliente_id' => $client->id,
            'contrato_id' => null,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => today(),
            'socio_id' => $this->admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $this->admin->id,
            'fecha_creacion' => now(),
        ]);

        $this->artisan('visits:vincular-contratos-huerfanos', ['--execute' => true])->assertSuccessful();
        $this->assertDatabaseHas('visits', ['id' => $visit->id, 'contrato_id' => null]);
    }
}
