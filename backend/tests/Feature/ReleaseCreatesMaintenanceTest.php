<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterHistory;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReleaseCreatesMaintenanceTest extends TestCase
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

    private function createClient(User $user): Client
    {
        return Client::create([
            'razon_social' => 'Cliente ' . uniqid(),
            'rfc' => strtoupper(substr(md5(uniqid()), 0, 10)),
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
        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp'], ['nombre' => 'HP']);
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

    private function createContractWithPrinter(User $admin, Printer $printer): Contract
    {
        $client = $this->createClient($admin);

        $contract = Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today()->startOfMonth()->toDateString(),
            'tarifa_base' => 1000,
            'paginas_incluidas' => 0,
            'costo_pag_excedente' => 0.01,
            'dias_gracia' => 15,
            'frecuencia_visitas' => 'MENSUAL',
            'dias_adelanto' => 7,
            'estado' => ContractStatus::ACTIVO,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => today()->startOfMonth()->toDateString(),
            'lectura_inicial' => 0,
            'activa' => true,
        ]);

        $printer->update(['estado' => PrinterStatus::RENTADA]);

        return $contract;
    }

    public function test_retiro_por_falla_con_flag_crea_orden_correctiva_transaccional(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);

        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);
        $visit = Visit::create([
            'cliente_id' => $contract->cliente_id,
            'contrato_id' => $contract->id,
            'tipo_visita' => VisitType::RETIRO,
            'fecha_programada' => today()->toDateString(),
            'socio_id' => $admin->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $response = $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'visita_id' => $visit->id,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
            'justificacion_sin_lectura' => 'Equipo muerto',
            'crear_orden_mantenimiento' => true,
            'desc_problema' => 'No enciende, olor a quemado',
        ]);

        $response->assertOk();

        // La orden nace dentro de la transacción del retiro.
        $this->assertDatabaseHas('maintenance_orders', [
            'impresora_id' => $printer->id,
            'tipo_mantto' => 'CORRECTIVO',
            'estado' => 'PROGRAMADA',
            'visita_id' => $visit->id,
            'estado_anterior_impresora' => 'EN_ALMACEN',
            'desc_problema' => 'No enciende, olor a quemado',
        ]);

        $orderId = \App\Models\MaintenanceOrder::where('impresora_id', $printer->id)->first()->id;

        // La impresora queda EN_MANTENIMIENTO con el almacén estampado por el retiro.
        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'EN_MANTENIMIENTO',
            'almacen_id' => $warehouse->id,
        ]);

        // Eventos de historial: inicio de mantenimiento y trazabilidad bidireccional.
        $this->assertTrue(
            PrinterHistory::where('impresora_id', $printer->id)
                ->where('tipo_evento', 'MANTENIMIENTO_INICIO')
                ->where('datos_adicionales->orden_mantto_id', $orderId)
                ->exists()
        );

        $liberacion = PrinterHistory::where('impresora_id', $printer->id)
            ->where('tipo_evento', 'LIBERACION_CONTRATO')
            ->first();
        $this->assertSame($orderId, $liberacion->datos_adicionales['orden_mantto_id'] ?? null);

        // La visita NO se cierra automáticamente (regla del proyecto).
        $this->assertDatabaseHas('visits', ['id' => $visit->id, 'estado' => 'PENDIENTE']);

        // Integración con restore consciente: completar devuelve a EN_ALMACEN.
        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Cambio de fuente',
            'costo_mano_obra' => 300,
        ])->assertOk();

        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'EN_ALMACEN',
            'almacen_id' => $warehouse->id,
        ]);
    }

    public function test_flag_con_motivo_rotacion_es_422_y_el_retiro_se_revierte(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);
        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'ROTACION',
            'justificacion_sin_lectura' => 'Rotación preventiva',
            'crear_orden_mantenimiento' => true,
            'desc_problema' => 'Cualquier cosa',
        ])->assertStatus(422);

        // Nada aplicado: sin orden, sin liberación.
        $this->assertDatabaseCount('maintenance_orders', 0);
        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $printer->id,
            'activa' => true,
        ]);
        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'RENTADA',
        ]);
    }

    public function test_flag_sin_desc_problema_es_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);
        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
            'justificacion_sin_lectura' => 'Equipo muerto',
            'crear_orden_mantenimiento' => true,
        ])->assertStatus(422)->assertJsonValidationErrors(['desc_problema']);

        $this->assertDatabaseCount('maintenance_orders', 0);
    }

    public function test_retiro_sin_flag_no_crea_orden(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);
        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
            'justificacion_sin_lectura' => 'Equipo muerto',
        ])->assertOk();

        $this->assertDatabaseCount('maintenance_orders', 0);
        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'EN_ALMACEN',
        ]);
    }
}
