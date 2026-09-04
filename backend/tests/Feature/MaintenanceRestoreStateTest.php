<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractPrinter;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterHistory;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenanceRestoreStateTest extends TestCase
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
        $client = Client::create([
            'razon_social' => 'Cliente ' . uniqid(),
            'rfc' => strtoupper(substr(md5(uniqid()), 0, 10)),
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

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

    private function createCorrectiveOrder(User $admin, Printer $printer): int
    {
        return $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'No imprime',
        ])->assertCreated()->json('id');
    }

    public function test_completar_orden_tras_retiro_deja_impresora_en_almacen(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);
        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);

        $orderId = $this->createCorrectiveOrder($admin, $printer);
        $this->assertDatabaseHas('printers', ['id' => $printer->id, 'estado' => 'EN_MANTENIMIENTO']);

        // Retiro por falla mientras la orden está abierta.
        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
            'justificacion_sin_lectura' => 'Equipo muerto',
        ])->assertOk();

        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'EN_ALMACEN',
            'almacen_id' => $warehouse->id,
        ]);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Cambio de fusor',
            'costo_mano_obra' => 100,
        ])->assertOk();

        // La impresora NO vuelve a RENTADA: conserva EN_ALMACEN (fue liberada).
        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'EN_ALMACEN',
            'almacen_id' => $warehouse->id,
        ]);

        $this->assertSame(
            0,
            ContractPrinter::where('impresora_id', $printer->id)->where('activa', true)->count()
        );

        $evento = PrinterHistory::where('impresora_id', $printer->id)
            ->where('tipo_evento', 'MANTENIMIENTO_FIN')
            ->first();
        $this->assertTrue((bool) $evento->datos_adicionales['restauracion_omitida']);
        $this->assertSame('EN_ALMACEN', $evento->datos_adicionales['estado_conservado']);
    }

    public function test_cancelar_orden_tras_retiro_deja_impresora_en_almacen(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);
        $warehouse = Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);

        $orderId = $this->createCorrectiveOrder($admin, $printer);

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
            'justificacion_sin_lectura' => 'Equipo muerto',
        ])->assertOk();

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/cancel")->assertOk();

        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'EN_ALMACEN',
            'almacen_id' => $warehouse->id,
        ]);
    }

    public function test_completar_orden_sin_retiro_intermedio_restaura_rentada(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $this->createContractWithPrinter($admin, $printer);

        $orderId = $this->createCorrectiveOrder($admin, $printer);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Reparado',
            'costo_mano_obra' => 50,
        ])->assertOk();

        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'RENTADA',
        ]);
    }

    public function test_estado_anterior_rentada_sin_contrato_activo_regresa_a_almacen(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);

        $orderId = $this->createCorrectiveOrder($admin, $printer);

        // El contrato terminó mientras se reparaba: la fila deja de estar
        // activa sin que nadie moviera la impresora (sigue EN_MANTENIMIENTO).
        ContractPrinter::where('contrato_id', $contract->id)
            ->where('impresora_id', $printer->id)
            ->update(['activa' => false, 'fecha_liberacion' => now()]);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Reparado',
            'costo_mano_obra' => 50,
        ])->assertOk();

        // Nunca RENTADA huérfana: regresa a EN_ALMACEN.
        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'EN_ALMACEN',
        ]);
    }

    public function test_impresora_dada_de_baja_conserva_su_estado(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $this->createContractWithPrinter($admin, $printer);

        $orderId = $this->createCorrectiveOrder($admin, $printer);

        // Alguien la dio de baja mientras la orden estaba abierta.
        $printer->update(['estado' => PrinterStatus::DADA_DE_BAJA]);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Irreparable',
            'costo_mano_obra' => 0,
        ])->assertOk();

        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'DADA_DE_BAJA',
        ]);

        $evento = PrinterHistory::where('impresora_id', $printer->id)
            ->where('tipo_evento', 'MANTENIMIENTO_FIN')
            ->first();
        $this->assertTrue((bool) $evento->datos_adicionales['restauracion_omitida']);
        $this->assertSame('DADA_DE_BAJA', $evento->datos_adicionales['estado_conservado']);
    }
}
