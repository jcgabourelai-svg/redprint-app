<?php

namespace Tests\Feature;

use App\Enums\ArticleType;
use App\Enums\ContractStatus;
use App\Enums\PrinterStatus;
use App\Enums\VisitFrequency;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Article;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\PrinterHistory;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use App\Models\Warehouse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VisitCompletionTest extends TestCase
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

    private function createClientContract(User $user): array
    {
        $client = Client::create([
            'razon_social' => 'Cliente Cierre SA',
            'rfc' => 'CCS' . substr(md5(uniqid()), 0, 7),
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
            'estado' => PrinterStatus::EN_ALMACEN,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    public function test_complete_sin_actividades_y_sin_motivo_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $visit = $this->createVisit($contract, $admin);

        $this->postJson("/api/v1/visits/{$visit->id}/complete", [])
            ->assertStatus(422)
            ->assertJsonPath('message', 'La visita no tiene actividades registradas: indica un motivo de cierre');

        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::PENDIENTE->value,
        ]);
    }

    public function test_complete_con_motivo_lo_persiste(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $visit = $this->createVisit($contract, $admin);

        $this->postJson("/api/v1/visits/{$visit->id}/complete", [
            'motivo_cierre' => 'Cliente sin personal disponible',
        ])
            ->assertOk()
            ->assertJsonPath('estado', 'COMPLETADA')
            ->assertJsonPath('motivo_cierre', 'Cliente sin personal disponible');

        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::COMPLETADA->value,
            'motivo_cierre' => 'Cliente sin personal disponible',
        ]);
        $this->assertNotNull($visit->fresh()->fecha_realizada);
    }

    public function test_complete_con_entrega_registrada_no_exige_motivo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $visit = $this->createVisit($contract, $admin);

        $article = Article::create([
            'tipo_articulo' => ArticleType::CONSUMIBLE,
            'subtipo' => 'TONER',
            'nombre' => 'Tóner Test',
            'marca' => 'HP',
            'modelo_sku' => '85A',
            'stock_actual' => 10,
            'umbral_reposicion' => 2,
            'costo_unitario' => 50.00,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 1,
        ])->assertCreated();

        $this->postJson("/api/v1/visits/{$visit->id}/complete", [])
            ->assertOk()
            ->assertJsonPath('estado', 'COMPLETADA');
    }

    public function test_complete_sobre_visita_completada_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $visit = $this->createVisit($contract, $admin, ['estado' => VisitStatus::COMPLETADA]);

        $this->postJson("/api/v1/visits/{$visit->id}/complete", [
            'motivo_cierre' => 'Reintento',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'La visita ya está completada');
    }

    public function test_capturar_lecturas_no_completa_la_visita_automaticamente(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createPrinter($admin, ['estado' => PrinterStatus::RENTADA]);
        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => now(),
            'lectura_inicial' => 1000,
            'activa' => true,
        ]);
        $visit = $this->createVisit($contract, $admin);

        $this->postJson('/api/v1/readings', [
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'contrato_id' => $contract->id,
            'fecha' => today()->toDateString(),
            'valor_contador' => 1500,
        ])->assertCreated();

        $this->assertDatabaseHas('readings', [
            'visita_id' => $visit->id,
            'impresora_id' => $printer->id,
            'valor_contador' => 1500,
            'paginas_periodo' => 500,
        ]);

        // La visita sigue PENDIENTE: el cierre es siempre explicito y permite
        // seguir registrando actividades (fallas, insumos, retiros...).
        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::PENDIENTE->value,
        ]);

        // El cierre explicito sigue funcionando sin motivo: la lectura ya
        // cuenta como actividad registrada.
        $this->postJson("/api/v1/visits/{$visit->id}/complete", [])
            ->assertOk()
            ->assertJsonPath('estado', 'COMPLETADA');
    }

    public function test_assign_printer_con_visita_id_vincula_y_mantiene_visita_pendiente(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createPrinter($admin);
        $visit = $this->createVisit($contract, $admin, ['tipo_visita' => VisitType::INSTALACION]);

        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $printer->id,
            'lectura_inicial' => 100,
            'visita_id' => $visit->id,
        ])->assertOk();

        $this->assertTrue(
            PrinterHistory::where('impresora_id', $printer->id)
                ->where('tipo_evento', 'ASIGNACION_CONTRATO')
                ->where('datos_adicionales->visita_id', $visit->id)
                ->exists()
        );

        // Sin autocierre: la instalación no cierra la visita; el cierre es
        // siempre explicito (permite seguir capturando insumos, lecturas...).
        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::PENDIENTE->value,
        ]);

        $this->getJson("/api/v1/visits/{$visit->id}")
            ->assertOk()
            ->assertJsonPath('estado', 'PENDIENTE')
            ->assertJsonPath('cambios_impresoras.0.evento', 'ASIGNACION_CONTRATO')
            ->assertJsonPath('cambios_impresoras.0.impresora.id', $printer->id)
            ->assertJsonPath('cambios_impresoras.0.impresora.marca', 'HP');
    }

    public function test_assign_printer_y_luego_entrega_de_insumos_en_la_misma_visita(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createPrinter($admin);
        $visit = $this->createVisit($contract, $admin, ['tipo_visita' => VisitType::INSTALACION]);

        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $printer->id,
            'lectura_inicial' => 100,
            'visita_id' => $visit->id,
        ])->assertOk();

        $article = Article::create([
            'tipo_articulo' => ArticleType::CONSUMIBLE,
            'subtipo' => 'TONER',
            'nombre' => 'Tóner Post-Instalación',
            'marca' => 'HP',
            'modelo_sku' => '85A',
            'stock_actual' => 10,
            'umbral_reposicion' => 2,
            'costo_unitario' => 50.00,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        // Regresion del caso real: instalar y despues entregar un tóner en
        // la MISMA visita (antes del autocierre esto devolvía 422).
        $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 1,
        ])->assertCreated();

        $this->assertDatabaseHas('article_deliveries', [
            'visita_id' => $visit->id,
            'articulo_id' => $article->id,
            'cantidad' => 1,
        ]);
        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::PENDIENTE->value,
        ]);
    }

    public function test_assign_printer_segunda_instalacion_sobre_visita_completada_no_falla(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printerA = $this->createPrinter($admin);
        $printerB = $this->createPrinter($admin);
        $visit = $this->createVisit($contract, $admin, ['tipo_visita' => VisitType::INSTALACION]);

        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $printerA->id,
            'visita_id' => $visit->id,
        ])->assertOk();

        // Cierre explicito por el operador (la instalación ya cuenta como
        // actividad registrada), y aun así una segunda instalación es válida.
        $this->postJson("/api/v1/visits/{$visit->id}/complete", [])
            ->assertOk()
            ->assertJsonPath('estado', 'COMPLETADA');

        $this->postJson("/api/v1/contracts/{$contract->id}/assign-printer", [
            'impresora_id' => $printerB->id,
            'visita_id' => $visit->id,
        ])->assertOk();

        $this->assertEquals(
            2,
            PrinterHistory::where('tipo_evento', 'ASIGNACION_CONTRATO')
                ->where('datos_adicionales->visita_id', $visit->id)
                ->count()
        );
        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::COMPLETADA->value,
        ]);
    }

    public function test_assign_printer_con_visita_de_otro_contrato_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$clientA, $contractA] = $this->createClientContract($admin);
        [$clientB, $contractB] = $this->createClientContract($admin);
        $printer = $this->createPrinter($admin);
        $visit = $this->createVisit($contractB, $admin, ['tipo_visita' => VisitType::INSTALACION]);

        $this->postJson("/api/v1/contracts/{$contractA->id}/assign-printer", [
            'impresora_id' => $printer->id,
            'visita_id' => $visit->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'La visita indicada no pertenece a este contrato');

        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::PENDIENTE->value,
        ]);
        $this->assertDatabaseMissing('printer_histories', ['impresora_id' => $printer->id]);
    }

    public function test_release_printer_con_visita_id_vincula_y_mantiene_visita_pendiente(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createPrinter($admin, ['estado' => PrinterStatus::RENTADA]);
        $contract->printers()->attach($printer->id, [
            'fecha_asignacion' => now(),
            'lectura_inicial' => 0,
            'activa' => true,
        ]);

        $warehouse = Warehouse::create([
            'nombre' => 'Almacén Test',
            'direccion' => 'Calle Almacén 1',
        ]);

        $visit = $this->createVisit($contract, $admin, ['tipo_visita' => VisitType::RETIRO]);

        $this->postJson("/api/v1/contracts/{$contract->id}/release-printer", [
            'impresora_id' => $printer->id,
            'almacen_destino_id' => $warehouse->id,
            'visita_id' => $visit->id,
        ])->assertOk();

        $this->assertTrue(
            PrinterHistory::where('impresora_id', $printer->id)
                ->where('tipo_evento', 'LIBERACION_CONTRATO')
                ->where('datos_adicionales->visita_id', $visit->id)
                ->exists()
        );

        // Sin autocierre (misma regla que la instalación): cierre explicito.
        $this->assertDatabaseHas('visits', [
            'id' => $visit->id,
            'estado' => VisitStatus::PENDIENTE->value,
        ]);

        $this->getJson("/api/v1/visits/{$visit->id}")
            ->assertOk()
            ->assertJsonPath('cambios_impresoras.0.evento', 'LIBERACION_CONTRATO');
    }

    public function test_orden_mantenimiento_con_visita_id_visible_en_detalle(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$client, $contract] = $this->createClientContract($admin);
        $printer = $this->createPrinter($admin, ['estado' => PrinterStatus::RENTADA]);
        $visit = $this->createVisit($contract, $admin, ['tipo_visita' => VisitType::MANTENIMIENTO]);

        $response = $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Atasco recurrente en bandeja 2',
            'visita_id' => $visit->id,
        ]);

        $orderId = $response->assertCreated()->json('id');

        $this->getJson("/api/v1/visits/{$visit->id}")
            ->assertOk()
            ->assertJsonPath('mantenimientos.0.id', $orderId)
            ->assertJsonPath('mantenimientos.0.tipo_mantto', 'CORRECTIVO')
            ->assertJsonPath('mantenimientos.0.desc_problema', 'Atasco recurrente en bandeja 2')
            ->assertJsonPath('mantenimientos.0.visita_id', $visit->id)
            ->assertJsonPath('mantenimientos.0.printer.marca', 'HP');
    }

    public function test_requiere_permisos_para_completar(): void
    {
        $sinPermiso = $this->userWithPermissions(['inventario.articulos']);
        Sanctum::actingAs($sinPermiso);

        [$client, $contract] = $this->createClientContract($sinPermiso);
        $visit = $this->createVisit($contract, $sinPermiso);

        $this->postJson("/api/v1/visits/{$visit->id}/complete", [
            'motivo_cierre' => 'Sin permiso',
        ])->assertStatus(403);
    }
}
