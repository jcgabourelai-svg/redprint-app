<?php

namespace Tests\Feature;

use App\Enums\ContractStatus;
use App\Enums\MaintenanceType;
use App\Enums\PrinterStatus;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Client;
use App\Models\Contract;
use App\Models\MaintenanceOrder;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterHistory;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Models\Warehouse;
use App\Services\MaintenanceService;
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

    /**
     * Usuario NO sistema con solo los permisos indicados (para probar los
     * guards de permiso del retiro con orden).
     */
    private function userWithPermissions(array $claves): User
    {
        $role = Role::create([
            'nombre' => 'Rol Test',
            'slug' => 'rol-test-' . uniqid(),
            'es_sistema' => false,
        ]);

        foreach ($claves as $clave) {
            $permiso = Permission::firstOrCreate(
                ['clave' => $clave],
                ['modulo' => 'test', 'etiqueta' => $clave]
            );
            $role->permissions()->attach($permiso->id);
        }

        return User::create([
            'nombre' => 'User Test',
            'correo' => 'user-' . uniqid() . '@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0101',
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

    private function createContractWithPrinter(User $admin, ?Printer $printer = null): Contract
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

        if ($printer !== null) {
            $contract->printers()->attach($printer->id, [
                'fecha_asignacion' => today()->startOfMonth()->toDateString(),
                'lectura_inicial' => 0,
                'activa' => true,
            ]);

            $printer->update(['estado' => PrinterStatus::RENTADA]);
        }

        return $contract;
    }

    private function createWarehouse(): Warehouse
    {
        return Warehouse::create(['nombre' => 'Almacén', 'direccion' => 'Calle 1']);
    }

    /**
     * Retiro por un motivo NO falla con flag de orden (D24): nace una orden
     * PREVENTIVA en la misma transacción y la impresora va a taller.
     */
    private function retirarConOrdenPreventiva(User $admin, Contract $contract, Printer $printer, Warehouse $warehouse): MaintenanceOrder
    {
        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'ROTACION',
            'justificacion_sin_lectura' => 'Rotación de flota',
            'crear_orden_mantenimiento' => true,
        ])->assertOk();

        return MaintenanceOrder::where('impresora_id', $printer->id)->firstOrFail();
    }

    public function test_retiro_por_falla_con_flag_crea_orden_correctiva_transaccional(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);

        $warehouse = $this->createWarehouse();
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

        $orderId = MaintenanceOrder::where('impresora_id', $printer->id)->first()->id;

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

    public function test_retiro_rotacion_con_flag_crea_orden_preventiva_y_manda_a_taller(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);
        $warehouse = $this->createWarehouse();

        $order = $this->retirarConOrdenPreventiva($admin, $contract, $printer, $warehouse);

        // Orden PREVENTIVA abierta, con estado_anterior para restaurar (D24).
        $this->assertDatabaseHas('maintenance_orders', [
            'impresora_id' => $printer->id,
            'tipo_mantto' => 'PREVENTIVO',
            'estado' => 'PROGRAMADA',
            'estado_anterior_impresora' => 'EN_ALMACEN',
        ]);

        // D6: sin notas, la desc se autocompleta con el contrato de origen.
        $this->assertSame(
            "Servicio preventivo al retirar del contrato {$contract->codigo_negocio}",
            $order->desc_problema
        );

        // La impresora queda EN_MANTENIMIENTO (taller) con el almacén del retiro.
        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'EN_MANTENIMIENTO',
            'almacen_id' => $warehouse->id,
        ]);

        // Trazabilidad bidireccional en la liberación.
        $liberacion = PrinterHistory::where('impresora_id', $printer->id)
            ->where('tipo_evento', 'LIBERACION_CONTRATO')
            ->first();
        $this->assertSame($order->id, $liberacion->datos_adicionales['orden_mantto_id'] ?? null);

        // Inicio de mantenimiento con el tipo en la descripción.
        $this->assertTrue(
            PrinterHistory::where('impresora_id', $printer->id)
                ->where('tipo_evento', 'MANTENIMIENTO_INICIO')
                ->where('descripcion', "Inicio mantenimiento preventivo - Orden #{$order->id}")
                ->where('datos_adicionales->orden_mantto_id', $order->id)
                ->exists()
        );

        // Completar devuelve la impresora a EN_ALMACEN (restauración por
        // estado_anterior, no por tipo: D3).
        $this->postJson("/api/v1/maintenance-orders/{$order->id}/complete", [
            'trabajo_realizado' => 'Limpieza general y kit de mantenimiento',
            'costo_mano_obra' => 150,
        ])->assertOk();

        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'EN_ALMACEN',
            'almacen_id' => $warehouse->id,
        ]);

        // El cierre preventivo escribe AMBOS eventos: el servicio y el fin
        // de estadía en taller.
        $this->assertTrue(
            PrinterHistory::where('impresora_id', $printer->id)
                ->where('tipo_evento', 'MANTENIMIENTO_PREVENTIVO')
                ->where('datos_adicionales->orden_mantto_id', $order->id)
                ->exists()
        );
        $this->assertTrue(
            PrinterHistory::where('impresora_id', $printer->id)
                ->where('tipo_evento', 'MANTENIMIENTO_PREVENTIVO_FIN')
                ->where('datos_adicionales->estado_restaurado', 'EN_ALMACEN')
                ->exists()
        );
    }

    public function test_cancelar_o_eliminar_orden_preventiva_de_retiro_restaura_almacen(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $warehouse = $this->createWarehouse();

        // Cancelación.
        $printerA = $this->createPrinter($admin);
        $contractA = $this->createContractWithPrinter($admin, $printerA);
        $orderA = $this->retirarConOrdenPreventiva($admin, $contractA, $printerA, $warehouse);

        $this->postJson("/api/v1/maintenance-orders/{$orderA->id}/cancel")->assertOk();

        $this->assertDatabaseHas('printers', [
            'id' => $printerA->id,
            'estado' => 'EN_ALMACEN',
            'almacen_id' => $warehouse->id,
        ]);
        $this->assertTrue(
            PrinterHistory::where('impresora_id', $printerA->id)
                ->where('tipo_evento', 'MANTENIMIENTO_CANCELADO')
                ->where('datos_adicionales->estado_restaurado', 'EN_ALMACEN')
                ->exists()
        );

        // Eliminación (la orden se borra y el equipo vuelve a circulación).
        $printerB = $this->createPrinter($admin);
        $contractB = $this->createContractWithPrinter($admin, $printerB);
        $orderB = $this->retirarConOrdenPreventiva($admin, $contractB, $printerB, $warehouse);

        $this->deleteJson("/api/v1/maintenance-orders/{$orderB->id}")->assertNoContent();

        $this->assertDatabaseHas('printers', [
            'id' => $printerB->id,
            'estado' => 'EN_ALMACEN',
            'almacen_id' => $warehouse->id,
        ]);
        $this->assertTrue(
            PrinterHistory::where('impresora_id', $printerB->id)
                ->where('tipo_evento', 'MANTENIMIENTO_ELIMINADO')
                ->where('datos_adicionales->estado_restaurado', 'EN_ALMACEN')
                ->exists()
        );
    }

    public function test_retiro_con_orden_cuando_ya_hay_orden_abierta_es_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);
        $warehouse = $this->createWarehouse();

        // Hueco D7: falla reportada en sitio (orden correctiva abierta sobre
        // la rentada) y luego retiro con orden.
        $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'No imprime nada',
        ])->assertCreated();

        $response = $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'SUSTITUCION_FALLA',
            'justificacion_sin_lectura' => 'Equipo muerto',
            'crear_orden_mantenimiento' => true,
            'desc_problema' => 'Mismo problema de la orden existente',
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString(
            'orden de mantenimiento abierta',
            (string) $response->json('message')
        );

        // Transacción revertida: sigue habiendo UNA sola orden (la original)
        // y la asignación sigue activa.
        $this->assertSame(1, MaintenanceOrder::where('impresora_id', $printer->id)->count());
        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $printer->id,
            'activa' => true,
        ]);
    }

    public function test_assign_printer_bloqueada_por_orden_abierta_hasta_cancelarla(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin);

        // Orden preventiva creada desde web sobre equipo en almacén (sin
        // sacarDeCirculacion: la impresora sigue EN_ALMACEN).
        $order = app(MaintenanceService::class)->create([
            'impresora_id' => $printer->id,
            'fecha' => today(),
            'tipo_mantto' => MaintenanceType::PREVENTIVO,
            'desc_problema' => 'Servicio preventivo programado',
        ], $admin);

        $this->assertDatabaseHas('printers', ['id' => $printer->id, 'estado' => 'EN_ALMACEN']);

        // Bloqueo duro (D24): aunque está EN_ALMACEN, la orden abierta impide
        // la asignación.
        $response = $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $printer->id,
            'lectura_inicial' => 0,
        ]);

        $response->assertStatus(422);
        $this->assertStringContainsString(
            "abierta (#{$order->id})",
            (string) $response->json('message')
        );

        // Cancelada la orden, la asignación prospera.
        $this->postJson("/api/v1/maintenance-orders/{$order->id}/cancel")->assertOk();

        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $printer->id,
            'lectura_inicial' => 0,
        ])->assertOk();

        $this->assertDatabaseHas('printers', [
            'id' => $printer->id,
            'estado' => 'RENTADA',
        ]);
    }

    public function test_orden_preventiva_web_sin_flag_no_cambia_estado_ni_restaura(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $this->createContractWithPrinter($admin, $printer);

        // Preventiva de web (equipo rentado, servicio en visita): sin flag no
        // desplaza la impresora.
        $order = app(MaintenanceService::class)->create([
            'impresora_id' => $printer->id,
            'fecha' => today(),
            'tipo_mantto' => MaintenanceType::PREVENTIVO,
            'desc_problema' => 'Servicio preventivo en visita',
        ], $admin);

        $this->assertDatabaseHas('printers', ['id' => $printer->id, 'estado' => 'RENTADA']);
        $this->assertNull($order->estado_anterior_impresora);

        $this->postJson("/api/v1/maintenance-orders/{$order->id}/complete", [
            'trabajo_realizado' => 'Limpieza en sitio',
            'costo_mano_obra' => 50,
        ])->assertOk();

        // Sin estado_anterior no hay restauración: sigue RENTADA.
        $this->assertDatabaseHas('printers', ['id' => $printer->id, 'estado' => 'RENTADA']);
        $this->assertTrue(
            PrinterHistory::where('impresora_id', $printer->id)
                ->where('tipo_evento', 'MANTENIMIENTO_PREVENTIVO')
                ->where('datos_adicionales->orden_mantto_id', $order->id)
                ->exists()
        );
        $this->assertFalse(
            PrinterHistory::where('impresora_id', $printer->id)
                ->where('tipo_evento', 'MANTENIMIENTO_PREVENTIVO_FIN')
                ->exists()
        );
    }

    public function test_flag_sin_permiso_de_mantenimiento_es_403(): void
    {
        $admin = $this->adminUser();
        $user = $this->userWithPermissions(['contratos']);
        Sanctum::actingAs($user);

        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);
        $warehouse = $this->createWarehouse();

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'motivo_liberacion' => 'ROTACION',
            'justificacion_sin_lectura' => 'Rotación de flota',
            'crear_orden_mantenimiento' => true,
        ])->assertStatus(403);

        // Nada aplicado: sin orden, sin liberación.
        $this->assertDatabaseCount('maintenance_orders', 0);
        $this->assertDatabaseHas('contract_printer', [
            'impresora_id' => $printer->id,
            'activa' => true,
        ]);
    }

    public function test_flag_sin_desc_problema_es_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $contract = $this->createContractWithPrinter($admin, $printer);
        $warehouse = $this->createWarehouse();

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
        $warehouse = $this->createWarehouse();

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

    public function test_printers_index_y_detalle_incluyen_orden_abierta(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        $order = app(MaintenanceService::class)->create([
            'impresora_id' => $printer->id,
            'fecha' => today(),
            'tipo_mantto' => MaintenanceType::PREVENTIVO,
            'desc_problema' => 'Servicio preventivo programado',
        ], $admin);

        $row = $this->getJson('/api/v1/printers')
            ->assertOk()
            ->json('data.0');

        $this->assertSame($printer->id, $row['id']);
        $this->assertSame(1, $row['ordenes_abiertas_count']);
        $this->assertSame($order->id, $row['open_maintenance_order']['id']);
        $this->assertSame('PREVENTIVO', $row['open_maintenance_order']['tipo_mantto']);
        $this->assertSame('PROGRAMADA', $row['open_maintenance_order']['estado']);

        // Sin orden abierta (otra impresora): campos ausentes o null, nunca error.
        $printerLibre = $this->createPrinter($admin);
        $detalle = $this->getJson("/api/v1/printers/{$printerLibre->id}")->assertOk()->json();
        $this->assertSame(0, $detalle['ordenes_abiertas_count']);
        $this->assertNull($detalle['open_maintenance_order']);

        // El detalle de la impresora con orden también expone ambos campos.
        $detalleOrden = $this->getJson("/api/v1/printers/{$printer->id}")->assertOk()->json();
        $this->assertSame(1, $detalleOrden['ordenes_abiertas_count']);
        $this->assertSame($order->id, $detalleOrden['open_maintenance_order']['id']);
    }
}
