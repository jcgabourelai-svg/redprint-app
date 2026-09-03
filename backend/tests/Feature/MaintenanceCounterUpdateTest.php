<?php

namespace Tests\Feature;

use App\Enums\PrinterStatus;
use App\Models\Printer;
use App\Models\PrinterHistory;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenanceCounterUpdateTest extends TestCase
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

    private function createPrinter(User $user, int $contador): Printer
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
            'contador_actual' => $contador,
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

    public function test_completar_con_contador_lo_sincroniza_y_registra_historial(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin, 1500);
        $orderId = $this->createOrder($admin, $printer);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Limpieza de rodillos y pruebas',
            'costo_mano_obra' => 250,
            'contador_impresora' => 1580,
        ])->assertOk();

        // Las 80 páginas de pruebas del taller quedan en el contador de la serie.
        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'contador_actual' => 1580,
        ]);

        $evento = PrinterHistory::where('impresora_id', $printer->id)
            ->where('tipo_evento', 'ACTUALIZACION_CONTADOR')
            ->first();
        $this->assertNotNull($evento);
        $this->assertSame('MANTENIMIENTO', $evento->datos_adicionales['origen'] ?? null);
        $this->assertSame($orderId, $evento->datos_adicionales['orden_id'] ?? null);
    }

    public function test_completar_con_contador_menor_al_registrado_es_rechazado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin, 1500);
        $orderId = $this->createOrder($admin, $printer);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'costo_mano_obra' => 250,
            'contador_impresora' => 1400,
        ])->assertStatus(422);

        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'contador_actual' => 1500,
        ]);
        $this->assertDatabaseMissing('printer_histories', [
            'impresora_id' => $printer->id,
            'tipo_evento' => 'ACTUALIZACION_CONTADOR',
        ]);
    }

    public function test_completar_sin_contador_no_toca_el_contador(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin, 1500);
        $orderId = $this->createOrder($admin, $printer);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'costo_mano_obra' => 250,
        ])->assertOk();

        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'contador_actual' => 1500,
        ]);
        $this->assertDatabaseMissing('printer_histories', [
            'impresora_id' => $printer->id,
            'tipo_evento' => 'ACTUALIZACION_CONTADOR',
        ]);
    }
}
