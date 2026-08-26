<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\VisitFrequency;
use App\Enums\VisitStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SpontaneousVisitTest extends TestCase
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

    /**
     * Usuario con permisos explicitos (sin bypass de es_sistema).
     */
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

    public function test_clientes_devuelve_solo_clientes_con_contrato_activo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $conActivo = $this->createClient($admin, 'Con Activo SA');
        $this->createContract($conActivo, $admin);
        $conFinalizado = $this->createClient($admin, 'Finalizado SA');
        $this->createContract($conFinalizado, $admin, ['estado' => ContractStatus::FINALIZADO]);
        $this->createClient($admin, 'Sin Contrato SA');

        $response = $this->getJson('/api/v1/visits/clientes');

        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJson([
                [
                    'id' => $conActivo->id,
                    'razon_social' => 'Con Activo SA',
                    'contratos' => [
                        ['id' => $conActivo->contracts()->first()->id],
                    ],
                ],
            ]);

        $this->assertEquals(
            $conActivo->contracts()->first()->codigo_negocio,
            $response->json('0.contratos.0.codigo_negocio')
        );
    }

    public function test_clientes_excluye_contratos_no_activos_del_cliente(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Mixto SA');
        $this->createContract($client, $admin, ['estado' => ContractStatus::FINALIZADO]);
        $activo = $this->createContract($client, $admin, ['estado' => ContractStatus::ACTIVO]);

        $response = $this->getJson('/api/v1/visits/clientes');

        $response->assertOk()->assertJsonCount(1);
        $this->assertEquals([$activo->id], array_column($response->json('0.contratos'), 'id'));
    }

    public function test_clientes_requiere_permiso_operaciones_calendario(): void
    {
        $sinPermiso = $this->userWithPermissions(['inventario.articulos']);
        Sanctum::actingAs($sinPermiso);

        $this->getJson('/api/v1/visits/clientes')->assertStatus(403);
    }

    public function test_crea_visita_espontanea_con_contrato_y_origen_campo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Espontanea SA');
        $contract = $this->createContract($client, $admin);

        $response = $this->postJson('/api/v1/visits', [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'tipo_visita' => 'ENTREGA_INSUMOS',
            'fecha_programada' => today()->toDateString(),
            'socio_id' => $admin->id,
            'notas' => 'Visita espontanea',
            'origen' => 'CAMPO',
        ]);

        $response->assertCreated()
            ->assertJsonPath('origen', 'CAMPO')
            ->assertJsonPath('estado', VisitStatus::PENDIENTE->value)
            ->assertJsonPath('contrato_id', $contract->id);

        $this->assertDatabaseHas('visits', [
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'origen' => 'CAMPO',
            'estado' => VisitStatus::PENDIENTE->value,
            'creado_por' => $admin->id,
        ]);
    }

    public function test_rechaza_origen_fuera_de_catalogo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $client = $this->createClient($admin, 'Origen Invalido SA');
        $this->createContract($client, $admin);

        $response = $this->postJson('/api/v1/visits', [
            'cliente_id' => $client->id,
            'tipo_visita' => 'LECTURA',
            'fecha_programada' => today()->toDateString(),
            'socio_id' => $admin->id,
            'origen' => 'WEB_X',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['origen']);
        $this->assertDatabaseMissing('visits', ['origen' => 'WEB_X']);
    }
}
