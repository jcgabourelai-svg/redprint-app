<?php

namespace Tests\Feature;

use App\Enums\PrinterStatus;
use App\Models\Printer;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenanceServiceDateTest extends TestCase
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
            'estado' => PrinterStatus::EN_MANTENIMIENTO,
            'contador_actual' => 1000,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function createOrder(User $admin, Printer $printer): int
    {
        return $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Atasco recurrente',
            'tipo_problema' => 'ATASCOS',
            'severidad' => 'ALTA',
        ])->assertCreated()->json('id');
    }

    public function test_completar_con_fecha_servicio_la_registra(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);

        // La orden nace hoy; se simula una creada hace 3 dias cuyo servicio
        // real fue ayer (entre la creacion y el registro administrativo).
        DB::table('maintenance_orders')->where('id', $orderId)->update([
            'fecha_creacion' => now()->subDays(3),
        ]);

        $servicio = today()->subDay();

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Cambio de rodillos y pruebas',
            'costo_mano_obra' => 250,
            'fecha_servicio' => $servicio->toDateString(),
        ])->assertOk();

        $this->assertDatabaseHas('maintenance_orders', [
            'id' => $orderId,
            'estado' => 'COMPLETADA',
        ]);

        $orden = DB::table('maintenance_orders')->where('id', $orderId)->first();

        $this->assertSame(
            $servicio->toDateString(),
            substr((string) $orden->fecha_completado, 0, 10),
        );
    }

    public function test_completar_sin_fecha_servicio_usa_el_momento_actual(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Limpieza general',
            'costo_mano_obra' => 100,
        ])->assertOk();

        $orden = DB::table('maintenance_orders')->where('id', $orderId)->first();

        $this->assertNotNull($orden->fecha_completado);
        $this->assertSame(
            today()->toDateString(),
            substr((string) $orden->fecha_completado, 0, 10),
        );
    }

    public function test_completar_con_fecha_servicio_anterior_a_la_creacion_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);

        $respuesta = $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Trabajo realizado',
            'fecha_servicio' => today()->subDay()->toDateString(),
        ]);

        $respuesta->assertStatus(422);
        $this->assertStringContainsString('anterior a la creacion', $respuesta->json('message'));

        $this->assertDatabaseHas('maintenance_orders', [
            'id' => $orderId,
            'estado' => 'PROGRAMADA',
        ]);
    }

    public function test_completar_con_fecha_servicio_futura_es_rechazada(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Trabajo realizado',
            'fecha_servicio' => today()->addDay()->toDateString(),
        ])->assertStatus(422);

        $this->assertDatabaseHas('maintenance_orders', [
            'id' => $orderId,
            'estado' => 'PROGRAMADA',
        ]);
    }
}
