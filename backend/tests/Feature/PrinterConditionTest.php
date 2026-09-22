<?php

namespace Tests\Feature;

use App\Enums\ArticleType;
use App\Enums\MaintenanceStatus;
use App\Enums\PrinterStatus;
use App\Models\Article;
use App\Models\InventoryMovement;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterHistory;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PrinterConditionTest extends TestCase
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

    /** Usuario NO sistema: recibe exactamente los permisos indicados (con [] no recibe ninguno). */
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

    private function createPrinter(User $user): Printer
    {
        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp-' . substr(md5(uniqid()), 0, 4)], ['nombre' => 'HP']);

        $model = PrinterModel::create([
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
            'desc_problema' => 'Problema',
        ], $overrides))->assertCreated()->json('id');
    }

    public function test_orden_correctiva_alta_critica_marca_no_operativa(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);

        $this->createOrder($admin, $printer, ['severidad' => 'CRITICA']);
        $this->assertSame('NO_OPERATIVA', $printer->fresh()->condicion?->value);

        // Vuelve a REQUIERE_ATENCION con otra orden de severidad menor.
        $this->postJson("/api/v1/maintenance-orders/{$printer->fresh()->openMaintenanceOrder->id}/cancel")->assertOk();
        $this->createOrder($admin, $printer, ['severidad' => 'ALTA']);
        $this->assertSame('NO_OPERATIVA', $printer->fresh()->condicion?->value);
    }

    public function test_orden_correctiva_baja_media_o_null_marca_requiere_atencion(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $media = $this->createPrinter($admin);
        $this->createOrder($admin, $media, ['severidad' => 'MEDIA']);
        $this->assertSame('REQUIERE_ATENCION', $media->fresh()->condicion?->value);

        $this->postJson("/api/v1/maintenance-orders/{$media->fresh()->openMaintenanceOrder->id}/cancel")->assertOk();

        $baja = $this->createPrinter($admin);
        $this->createOrder($admin, $baja, ['severidad' => 'BAJA']);
        $this->assertSame('REQUIERE_ATENCION', $baja->fresh()->condicion?->value);

        $this->postJson("/api/v1/maintenance-orders/{$baja->fresh()->openMaintenanceOrder->id}/cancel")->assertOk();

        $sinSeveridad = $this->createPrinter($admin);
        $this->createOrder($admin, $sinSeveridad, ['severidad' => null]);
        $this->assertSame('REQUIERE_ATENCION', $sinSeveridad->fresh()->condicion?->value);
    }

    public function test_completar_orden_devuelve_operativa_y_queda_para_piezas_funciona(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        // Completar normal: OPERATIVA.
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer, ['severidad' => 'MEDIA']);
        $this->assertSame('REQUIERE_ATENCION', $printer->fresh()->condicion?->value);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Reparado',
            'costo_mano_obra' => 100,
        ])->assertOk();

        $this->assertSame('OPERATIVA', $printer->fresh()->condicion?->value);
        $this->assertSame(PrinterStatus::EN_ALMACEN->value, $printer->fresh()->estado->value);

        // Queda para piezas con impresora en almacén: PIEZAS.
        $printer2 = $this->createPrinter($admin);
        $orderId2 = $this->createOrder($admin, $printer2, ['severidad' => 'ALTA']);

        $this->postJson("/api/v1/maintenance-orders/{$orderId2}/complete", [
            'trabajo_realizado' => 'Irreparable',
            'costo_mano_obra' => 0,
            'queda_para_piezas' => true,
        ])->assertOk();

        $this->assertSame('PIEZAS', $printer2->fresh()->condicion?->value);
        $this->assertSame('Irreparable', $printer2->fresh()->condicion_nota);
    }

    public function test_queda_para_piezas_con_impresora_rentada_lanza_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);

        // Crear orden (impresora pasa a EN_MANTENIMIENTO) y simular que el
        // estado anterior era RENTADA: al completar vuelve a RENTADA porque
        // existe asignación activa... en su lugar usamos el caso simple:
        // restauración a RENTADA sin contrato activo la manda a EN_ALMACEN,
        // así que forzamos estado_anterior RENTADA + asignación activa real.
        $orderId = $this->createOrder($admin, $printer, ['severidad' => 'MEDIA']);

        // Creamos contrato + asignación activa y marcamos la impresora como
        // RENTADA mientras la orden estaba abierta (simula reingreso manual).
        $printer->fresh()->update(['estado' => PrinterStatus::RENTADA]);

        $response = $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'N/A',
            'queda_para_piezas' => true,
        ]);

        $response->assertStatus(422);
        $this->assertNotSame('PIEZAS', $printer->fresh()->condicion?->value ?? null);
    }

    public function test_assign_printer_rechaza_no_operativa_y_piezas(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);
        $printer->update(['condicion' => 'NO_OPERATIVA']);

        $client = \App\Models\Client::create([
            'razon_social' => 'Cliente ' . uniqid(),
            'rfc' => strtoupper(substr(md5(uniqid()), 0, 10)),
            'nombre_contacto' => 'Contacto',
            'telefono' => '555-0200',
            'correo' => 'cliente@test.com',
            'direccion_instalacion' => 'Calle Falsa 123',
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $contract = \App\Models\Contract::create([
            'cliente_id' => $client->id,
            'codigo_negocio' => 'CTR-' . uniqid(),
            'fecha_inicio' => today(),
            'tarifa_base' => 1000,
            'paginas_incluidas' => 0,
            'costo_pag_excedente' => 0.01,
            'dias_gracia' => 15,
            'frecuencia_visitas' => 'MENSUAL',
            'dias_adelanto' => 7,
            'estado' => 'ACTIVO',
            'creado_por' => $admin->id,
            'fecha_creacion' => now(),
        ]);

        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $printer->id,
        ])->assertStatus(422)->assertJson([
            'message' => 'La impresora está marcada como NO OPERATIVA. Corrige su condición técnica antes de asignarla a un contrato.',
        ]);

        // PIEZAS también bloquea.
        $printer->update(['condicion' => 'PIEZAS']);
        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $printer->id,
        ])->assertStatus(422);

        // REQUIERE_ATENCION no bloquea.
        $printer->update(['condicion' => 'REQUIERE_ATENCION']);
        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $printer->id,
        ])->assertOk();

        // Legacy sin condición tampoco bloquea.
        $printer2 = $this->createPrinter($admin); // condicion null (legacy)
        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $printer2->id,
        ])->assertOk();
    }

    public function test_patch_condicion_escribe_historial_y_exige_motivo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);

        // Sin motivo: 422.
        $this->patchJson("/api/v1/printers/{$printer->id}/condicion", [
            'condicion' => 'NO_OPERATIVA',
        ])->assertStatus(422);

        // Con motivo: historial con previa/nueva/motivo.
        $this->patchJson("/api/v1/printers/{$printer->id}/condicion", [
            'condicion' => 'NO_OPERATIVA',
            'condicion_nota' => 'Motor dañado',
            'motivo' => 'Diagnóstico de taller',
        ])->assertOk();

        $printer = $printer->fresh();
        $this->assertSame('NO_OPERATIVA', $printer->condicion?->value);
        $this->assertSame('Motor dañado', $printer->condicion_nota);
        $this->assertNotNull($printer->condicion_actualizada_en);

        $evento = PrinterHistory::where('impresora_id', $printer->id)
            ->where('tipo_evento', 'CONDICION_ACTUALIZADA')
            ->first();

        $this->assertNotNull($evento);
        $this->assertNull($evento->datos_adicionales['condicion_previa']);
        $this->assertSame('NO_OPERATIVA', $evento->datos_adicionales['condicion_nueva']);
        $this->assertSame('Diagnóstico de taller', $evento->datos_adicionales['motivo']);
        $this->assertSame('MANUAL', $evento->datos_adicionales['origen']);

        // Misma condición: no-op (sin duplicar historial).
        $this->patchJson("/api/v1/printers/{$printer->id}/condicion", [
            'condicion' => 'NO_OPERATIVA',
            'motivo' => 'Sin cambios',
        ])->assertOk();

        $this->assertSame(
            1,
            PrinterHistory::where('impresora_id', $printer->id)->where('tipo_evento', 'CONDICION_ACTUALIZADA')->count()
        );
    }

    public function test_extract_part_exige_piezas_y_registra_entrada_deshuese(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);

        // Sin condición PIEZAS: 422.
        $this->postJson("/api/v1/printers/{$printer->id}/extract-part", [
            'nombre_nuevo' => 'Fusor donado',
            'tipo_articulo' => 'REPARACION',
            'cantidad' => 1,
        ])->assertStatus(422);

        // Marcar donante y extraer.
        $this->patchJson("/api/v1/printers/{$printer->id}/condicion", [
            'condicion' => 'PIEZAS',
            'motivo' => 'Deshuese autorizado',
        ])->assertOk();

        $response = $this->postJson("/api/v1/printers/{$printer->id}/extract-part", [
            'nombre_nuevo' => 'Fusor donado',
            'tipo_articulo' => 'REPARACION',
            'cantidad' => 2,
            'costo_unitario' => 0,
        ])->assertCreated();

        $article = Article::find($response->json('id'));
        $this->assertSame('Fusor donado', $article->nombre);
        $this->assertSame(2, $article->stock_actual);

        $movimiento = InventoryMovement::where('articulo_id', $article->id)->first();
        $this->assertSame('DESHUESE', $movimiento->referencia_tipo);
        $this->assertSame($printer->id, $movimiento->referencia_id);
        $this->assertSame(0, (int) $movimiento->stock_anterior);
        $this->assertSame(2, (int) $movimiento->stock_posterior);

        $this->assertStringContainsString('[PIEZA EXTRAÍDA] Fusor donado x2', $printer->fresh()->condicion_nota);

        // Extracción hacia artículo existente también funciona.
        $this->postJson("/api/v1/printers/{$printer->id}/extract-part", [
            'articulo_id' => $article->id,
            'cantidad' => 1,
        ])->assertCreated();

        $this->assertSame(3, $article->fresh()->stock_actual);
    }

    public function test_donante_no_cambia_condicion_al_crear_o_completar_ordenes(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);

        $this->patchJson("/api/v1/printers/{$printer->id}/condicion", [
            'condicion' => 'PIEZAS',
            'motivo' => 'Deshuese autorizado',
        ])->assertOk();

        // Crear orden correctiva CRITICA: no toca la condición PIEZAS.
        $orderId = $this->createOrder($admin, $printer, ['severidad' => 'CRITICA']);
        $this->assertSame('PIEZAS', $printer->fresh()->condicion?->value);

        // Completar: sigue PIEZAS (sin queda_para_piezas).
        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Revisión final',
            'costo_mano_obra' => 0,
        ])->assertOk();

        $this->assertSame('PIEZAS', $printer->fresh()->condicion?->value);
    }

    public function test_endpoints_requieren_permiso_de_impresoras(): void
    {
        $admin = $this->adminUser();
        $sinPermiso = $this->userWithPermissions(['inventario.mantenimiento']);
        Sanctum::actingAs($sinPermiso);

        $printer = $this->createPrinter($admin);

        $this->patchJson("/api/v1/printers/{$printer->id}/condicion", [
            'condicion' => 'OPERATIVA',
            'motivo' => 'prueba',
        ])->assertForbidden();

        $this->postJson("/api/v1/printers/{$printer->id}/extract-part", [
            'nombre_nuevo' => 'Pieza',
            'tipo_articulo' => 'REPARACION',
            'cantidad' => 1,
        ])->assertForbidden();
    }
}
