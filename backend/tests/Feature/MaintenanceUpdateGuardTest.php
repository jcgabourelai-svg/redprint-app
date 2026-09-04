<?php

namespace Tests\Feature;

use App\Enums\PrinterStatus;
use App\Models\Printer;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenanceUpdateGuardTest extends TestCase
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

    private function createPrinter(User $user): Printer
    {
        $brand = \App\Models\PrinterBrand::create([
            'nombre' => 'HP',
            'slug' => 'hp-' . substr(md5(uniqid()), 0, 6),
        ]);

        $model = \App\Models\PrinterModel::create([
            'brand_id' => $brand->id,
            'nombre' => 'LaserJet Test ' . substr(md5(uniqid()), 0, 6),
        ]);

        return Printer::create([
            'marca' => 'HP',
            'modelo' => 'LaserJet Test',
            'printer_model_id' => $model->id,
            'num_serie' => 'SN-' . uniqid(),
            'fecha_adquisicion' => today(),
            'codigo_negocio' => 'IMP-' . uniqid(),
            'estado' => PrinterStatus::EN_ALMACEN,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function createOrder(User $admin, Printer $printer, array $overrides = []): int
    {
        return $this->postJson('/api/v1/maintenance-orders', array_merge([
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Atasco recurrente',
        ], $overrides))
            ->assertCreated()
            ->json('id');
    }

    public function test_put_sobre_orden_completada_es_rechazado_y_no_cambia_bd(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer, ['costo_mano_obra' => 150]);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Limpieza de rodillos',
            'costo_mano_obra' => 150,
        ])->assertOk();

        $response = $this->putJson("/api/v1/maintenance-orders/{$orderId}", [
            'costo_mano_obra' => 999,
            'trabajo_realizado' => 'Reescritura histórica',
        ]);

        $response->assertStatus(422);

        $this->assertDatabaseHas('maintenance_orders', [
            'id' => $orderId,
            'costo_mano_obra' => 150,
            'trabajo_realizado' => 'Limpieza de rodillos',
            'estado' => 'COMPLETADA',
        ]);
    }

    public function test_put_sobre_orden_cancelada_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/cancel")->assertOk();

        $this->putJson("/api/v1/maintenance-orders/{$orderId}", [
            'desc_problema' => 'Otra descripción',
        ])->assertStatus(422);
    }

    public function test_put_sobre_orden_programada_actualiza(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);

        $response = $this->putJson("/api/v1/maintenance-orders/{$orderId}", [
            'desc_problema' => 'Atasco en fuser',
            'costo_mano_obra' => 200,
        ]);

        $response->assertOk();
        $this->assertSame(200.0, (float) $response->json('costo_mano_obra'));

        $this->assertDatabaseHas('maintenance_orders', [
            'id' => $orderId,
            'desc_problema' => 'Atasco en fuser',
        ]);
    }
}
