<?php

namespace Tests\Feature;

use App\Enums\PrinterStatus;
use App\Models\PrinterHistory;
use App\Models\Printer;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenanceProblemFieldsTest extends TestCase
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

    private function createPrinter(User $user, array $overrides = []): Printer
    {
        $brand = \App\Models\PrinterBrand::create([
            'nombre' => 'HP',
            'slug' => 'hp-' . substr(md5(uniqid()), 0, 6),
        ]);

        $model = \App\Models\PrinterModel::create([
            'brand_id' => $brand->id,
            'nombre' => 'LaserJet Test ' . substr(md5(uniqid()), 0, 6),
        ]);

        return Printer::create(array_merge([
            'marca' => 'HP',
            'modelo' => 'LaserJet Test',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'IMP-' . uniqid(),
            'estado' => PrinterStatus::RENTADA,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    private function orderPayload(Printer $printer, array $overrides = []): array
    {
        return array_merge([
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'No imprime desde esta manana',
            'tipo_problema' => 'NO_IMPRIME',
            'severidad' => 'ALTA',
        ], $overrides);
    }

    public function test_store_con_tipo_problema_y_severidad_lo_persiste_y_expone(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        $response = $this->postJson('/api/v1/maintenance-orders', $this->orderPayload($printer));

        $response->assertCreated()
            ->assertJsonPath('tipo_problema', 'NO_IMPRIME')
            ->assertJsonPath('severidad', 'ALTA');

        $this->assertDatabaseHas('maintenance_orders', [
            'id' => $response->json('id'),
            'tipo_problema' => 'NO_IMPRIME',
            'severidad' => 'ALTA',
        ]);
    }

    public function test_store_con_foto_evidencia_lo_persiste_y_expone(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        $foto = 'data:image/jpeg;base64,' . str_repeat('A', 5000);

        $response = $this->postJson('/api/v1/maintenance-orders', $this->orderPayload($printer, [
            'foto_evidencia' => $foto,
        ]));

        $response->assertCreated()
            ->assertJsonPath('foto_evidencia', $foto);

        $this->assertDatabaseHas('maintenance_orders', [
            'id' => $response->json('id'),
            'foto_evidencia' => $foto,
        ]);
    }

    public function test_store_correctivo_sigue_enviando_impresora_a_mantenimiento(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        $orderId = $this->postJson('/api/v1/maintenance-orders', $this->orderPayload($printer))
            ->assertCreated()
            ->json('id');

        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => PrinterStatus::EN_MANTENIMIENTO->value,
        ]);

        $this->assertTrue(
            PrinterHistory::where('impresora_id', $printer->id)
                ->where('tipo_evento', 'MANTENIMIENTO_INICIO')
                ->where('datos_adicionales->orden_mantto_id', $orderId)
                ->exists()
        );
    }

    public function test_store_con_valores_invalidos_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        $this->postJson('/api/v1/maintenance-orders', $this->orderPayload($printer, [
            'tipo_problema' => 'NO_EXISTE',
            'severidad' => 'URGENTE',
        ]))->assertStatus(422)->assertInvalid(['tipo_problema', 'severidad']);

        $this->assertDatabaseCount('maintenance_orders', 0);
    }

    public function test_store_sin_campos_crea_orden(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        $this->postJson('/api/v1/maintenance-orders', $this->orderPayload($printer, [
            'tipo_problema' => null,
            'severidad' => null,
        ]))->assertCreated()
            ->assertJsonPath('tipo_problema', null)
            ->assertJsonPath('severidad', null);
    }

    public function test_index_filtra_por_severidad_y_tipo_problema(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $alta = $this->createPrinter($admin);
        $baja = $this->createPrinter($admin);

        $this->postJson('/api/v1/maintenance-orders', $this->orderPayload($alta, [
            'tipo_problema' => 'ATASCOS',
            'severidad' => 'ALTA',
        ]))->assertCreated();

        $this->postJson('/api/v1/maintenance-orders', $this->orderPayload($baja, [
            'tipo_problema' => 'NO_IMPRIME',
            'severidad' => 'BAJA',
        ]))->assertCreated();

        $this->getJson('/api/v1/maintenance-orders?severidad=ALTA')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.severidad', 'ALTA')
            ->assertJsonPath('data.0.tipo_problema', 'ATASCOS');

        $this->getJson('/api/v1/maintenance-orders?tipo_problema=NO_IMPRIME')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.severidad', 'BAJA');
    }
}
