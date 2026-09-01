<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitFrequency;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Services\VisitService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReadingVisitGuardTest extends TestCase
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

    private function createClientContract(User $user): array
    {
        $client = Client::create([
            'razon_social' => 'Cliente Guardia SA',
            'rfc' => 'CGS' . substr(md5(uniqid()), 0, 7),
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        $contract = Contract::create([
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
        ]);

        return [$client, $contract];
    }

    private function createVisit(Contract $contract, User $user, array $overrides = []): Visit
    {
        return Visit::create(array_merge([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => VisitType::LECTURA,
            'fecha_programada' => today(),
            'socio_id' => $user->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    private function createAttachedPrinter(User $user, Contract $contract): Printer
    {
        $brand = PrinterBrand::create([
            'nombre' => 'HP',
            'slug' => 'hp-' . substr(md5(uniqid()), 0, 6),
        ]);

        $model = PrinterModel::create([
            'brand_id' => $brand->id,
            'nombre' => 'LaserJet Test ' . substr(md5(uniqid()), 0, 6),
        ]);

        $printer = Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet Test',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'IMP-' . uniqid(),
            'estado' => PrinterStatus::RENTADA,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);

        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => now(),
            'lectura_inicial' => 1000,
            'activa' => true,
        ]);

        return $printer;
    }

    private function storePayload(Visit $visit, Printer $printer, Contract $contract): array
    {
        return [
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'contrato_id' => $contract->id,
            'fecha' => today()->toDateString(),
            'valor_contador' => 1500,
        ];
    }

    public function test_lectura_en_visita_pendiente_vencida_crea_lectura(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createAttachedPrinter($admin, $contract);
        $visit = $this->createVisit($contract, $admin, ['fecha_programada' => today()->subDays(2)]);

        $this->postJson('/api/v1/readings', $this->storePayload($visit, $printer, $contract))
            ->assertCreated();

        $this->assertDatabaseHas('readings', [
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'valor_contador' => 1500,
        ]);
    }

    public function test_lectura_en_visita_pendiente_de_hoy_crea_lectura(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createAttachedPrinter($admin, $contract);
        $visit = $this->createVisit($contract, $admin);

        $this->postJson('/api/v1/readings', $this->storePayload($visit, $printer, $contract))
            ->assertCreated();
    }

    public function test_lectura_en_visita_adelantada_a_3_dias_crea_lectura(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createAttachedPrinter($admin, $contract);
        $visit = $this->createVisit($contract, $admin, ['fecha_programada' => today()->addDays(3)]);

        $this->postJson('/api/v1/readings', $this->storePayload($visit, $printer, $contract))
            ->assertCreated();
    }

    public function test_lectura_en_visita_adelantada_a_6_dias_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createAttachedPrinter($admin, $contract);
        $visit = $this->createVisit($contract, $admin, ['fecha_programada' => today()->addDays(6)]);

        $this->postJson('/api/v1/readings', $this->storePayload($visit, $printer, $contract))
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                sprintf(
                    'La visita está programada para el %s, a más de %d días en el futuro. Reprograma la visita o crea una nueva.',
                    today()->addDays(6)->format('d/m/Y'),
                    VisitService::MAX_DIAS_ADELANTO,
                )
            );

        // La lectura no se crea ni se toca el contador de la impresora.
        $this->assertDatabaseMissing('readings', ['visita_id' => $visit->id]);
        $this->assertDatabaseHas('printers', ['id' => $printer->id, 'contador_actual' => 0]);
    }

    public function test_lectura_en_visita_completada_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createAttachedPrinter($admin, $contract);
        $visit = $this->createVisit($contract, $admin, ['estado' => VisitStatus::COMPLETADA]);

        $this->postJson('/api/v1/readings', $this->storePayload($visit, $printer, $contract))
            ->assertStatus(422)
            ->assertJsonPath('message', 'La visita está COMPLETADA y no admite captura de actividades.');

        $this->assertDatabaseMissing('readings', ['visita_id' => $visit->id]);
    }

    public function test_lectura_en_visita_cancelada_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createAttachedPrinter($admin, $contract);
        $visit = $this->createVisit($contract, $admin, ['estado' => VisitStatus::CANCELADA]);

        $this->postJson('/api/v1/readings', $this->storePayload($visit, $printer, $contract))
            ->assertStatus(422)
            ->assertJsonPath('message', 'La visita está CANCELADA y no admite captura de actividades.');
    }

    public function test_lectura_en_visita_omitida_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createAttachedPrinter($admin, $contract);
        $visit = $this->createVisit($contract, $admin, ['estado' => VisitStatus::OMITIDA]);

        $this->postJson('/api/v1/readings', $this->storePayload($visit, $printer, $contract))
            ->assertStatus(422)
            ->assertJsonPath('message', 'La visita está OMITIDA y no admite captura de actividades.');
    }

    public function test_lectura_en_visita_reprogramada_de_hoy_crea_lectura(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createAttachedPrinter($admin, $contract);
        $visit = $this->createVisit($contract, $admin, ['estado' => VisitStatus::REPROGRAMADA]);

        $this->postJson('/api/v1/readings', $this->storePayload($visit, $printer, $contract))
            ->assertCreated();
    }
}
