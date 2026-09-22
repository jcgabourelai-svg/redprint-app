<?php

namespace Tests\Feature;

use App\Enums\PrinterStatus;
use App\Models\Article;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TallerDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // El dashboard cachea 5 minutos: partir limpio en cada test.
        Cache::forget('taller.dashboard');
    }

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

    private function createPrinter(User $user, array $overrides = []): Printer
    {
        $brand = PrinterBrand::firstOrCreate(['slug' => 'hp-' . substr(md5(uniqid()), 0, 4)], ['nombre' => 'HP']);

        $model = PrinterModel::create([
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

    public function test_kpis_y_sin_orden_cuadran_con_fixtures(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        // NO_OPERATIVA con orden PROGRAMADA (severidad ALTA => NO_OPERATIVA).
        $conOrden = $this->createPrinter($admin);
        $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $conOrden->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Falla',
            'severidad' => 'ALTA',
        ])->assertCreated();

        // NO_OPERATIVA sin orden: debe aparecer en sin_orden.
        $sinOrden = $this->createPrinter($admin, ['condicion' => 'NO_OPERATIVA']);

        // Otras condiciones.
        $this->createPrinter($admin, ['condicion' => 'REQUIERE_ATENCION']);
        $this->createPrinter($admin, ['condicion' => 'PIEZAS']);
        $this->createPrinter($admin, ['condicion' => null]); // legacy sin condición
        $this->createPrinter($admin, ['condicion' => 'OPERATIVA']);
        $this->createPrinter($admin, ['estado' => PrinterStatus::DADA_DE_BAJA, 'condicion' => 'NO_OPERATIVA']);

        $dashboard = $this->getJson('/api/v1/taller/dashboard')->assertOk();

        // La NO_OPERATIVA con orden pasó a EN_MANTENIMIENTO (estado) y sigue
        // NO_OPERATIVA (condición); la dada de baja no cuenta.
        $this->assertSame(2, (int) $dashboard->json('kpis.no_operativas'));
        $this->assertSame(1, (int) $dashboard->json('kpis.requiere_atencion'));
        $this->assertSame(1, (int) $dashboard->json('kpis.en_taller'));
        $this->assertSame(1, (int) $dashboard->json('kpis.para_piezas'));
        $this->assertSame(1, (int) $dashboard->json('kpis.sin_condicion'));
        // Disponibles: la OPERATIVA en almacén sin orden + la legacy sin
        // condición (null no bloquea). PIEZAS y REQUIERE_ATENCION no cuentan.
        $this->assertSame(2, (int) $dashboard->json('kpis.disponibles_renta'));

        $sinOrdenIds = collect($dashboard->json('sin_orden'))->pluck('id');
        $this->assertContains($sinOrden->id, $sinOrdenIds);
        $this->assertNotContains($conOrden->id, $sinOrdenIds);
        $this->assertSame(1, $sinOrdenIds->count());

        // La cola contiene la orden creada.
        $this->assertSame(1, count($dashboard->json('cola')));
    }

    public function test_cola_ordenada_por_severidad_y_antiguedad(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $p1 = $this->createPrinter($admin);
        $p2 = $this->createPrinter($admin);
        $p3 = $this->createPrinter($admin);

        $crear = fn (int $impresoraId, ?string $severidad, string $hace) => $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $impresoraId,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Falla',
            'severidad' => $severidad,
        ])->assertCreated()->json('id');

        // Crear en desorden: BAJA vieja, null, CRITICA nueva.
        $ordenBaja = $crear($p1->id, 'BAJA', 'old');
        \App\Models\MaintenanceOrder::where('id', $ordenBaja)->update(['fecha_creacion' => now()->subDays(10)]);
        $ordenNull = $crear($p2->id, null, 'mid');
        \App\Models\MaintenanceOrder::where('id', $ordenNull)->update(['fecha_creacion' => now()->subDays(5)]);
        $ordenCritica = $crear($p3->id, 'CRITICA', 'new');

        $dashboard = $this->getJson('/api/v1/taller/dashboard')->assertOk();

        $cola = collect($dashboard->json('cola'));
        $this->assertSame(3, $cola->count());

        // CRITICA primero, luego BAJA (más vieja que null), null al final.
        $this->assertSame($ordenCritica, $cola[0]['orden_id']);
        $this->assertSame($ordenBaja, $cola[1]['orden_id']);
        $this->assertSame($ordenNull, $cola[2]['orden_id']);

        $this->assertSame(10, (int) $cola[1]['dias_desde_creacion']);
    }

    public function test_matriz_suma_totales(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        // 2 en almacén operativas + 1 rentada sin condición + 1 en taller (orden).
        $this->createPrinter($admin, ['condicion' => 'OPERATIVA']);
        $this->createPrinter($admin, ['condicion' => 'OPERATIVA']);
        $this->createPrinter($admin, ['estado' => PrinterStatus::RENTADA, 'condicion' => null]);

        $enTaller = $this->createPrinter($admin);
        $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $enTaller->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Falla',
            'severidad' => 'MEDIA',
        ])->assertCreated();

        $dashboard = $this->getJson('/api/v1/taller/dashboard')->assertOk();

        $matriz = collect($dashboard->json('matriz_estado_condicion'));

        $filaAlmacen = $matriz->firstWhere('estado', 'EN_ALMACEN');
        $this->assertSame(2, (int) $filaAlmacen['OPERATIVA']);
        $this->assertSame(2, (int) $filaAlmacen['total']);

        $filaRentada = $matriz->firstWhere('estado', 'RENTADA');
        $this->assertSame(1, (int) $filaRentada['sin_condicion']);
        $this->assertSame(1, (int) $filaRentada['total']);

        $filaMantenimiento = $matriz->firstWhere('estado', 'EN_MANTENIMIENTO');
        // La orden correctiva dejó REQUIERE_ATENCION (severidad MEDIA).
        $this->assertSame(1, (int) $filaMantenimiento['REQUIERE_ATENCION']);
        $this->assertSame(1, (int) $filaMantenimiento['total']);

        $this->assertSame(4, (int) $matriz->sum('total'));
    }

    public function test_piezas_bajo_umbral_y_productividad_presentes(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        Article::create([
            'tipo_articulo' => 'REPARACION',
            'subtipo' => 'Pieza',
            'nombre' => 'Fusor bajo umbral',
            'modelo_sku' => 'SKU-T1-' . uniqid(),
            'stock_actual' => 1,
            'umbral_reposicion' => 2,
            'costo_unitario' => 100,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        Article::create([
            'tipo_articulo' => 'REPARACION',
            'subtipo' => 'Pieza',
            'nombre' => 'Rodillo suficiente',
            'modelo_sku' => 'SKU-T2-' . uniqid(),
            'stock_actual' => 9,
            'umbral_reposicion' => 2,
            'costo_unitario' => 50,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        $dashboard = $this->getJson('/api/v1/taller/dashboard')->assertOk();

        $piezas = collect($dashboard->json('piezas_bajo_umbral'));
        $this->assertSame(1, $piezas->count());
        $this->assertSame('Fusor bajo umbral', $piezas[0]['nombre']);
        $this->assertSame(2, (int) $piezas[0]['stock_minimo']);

        $this->assertArrayHasKey('productividad_mes', $dashboard->json());
        $this->assertSame(0, (int) $dashboard->json('productividad_mes.abiertas'));
    }

    public function test_dashboard_requiere_permiso_de_mantenimiento(): void
    {
        $sinPermiso = $this->userWithPermissions(['inventario.impresoras']);
        Sanctum::actingAs($sinPermiso);

        $this->getJson('/api/v1/taller/dashboard')->assertForbidden();
    }
}
