<?php

namespace Tests\Feature;

use App\Enums\ArticleType;
use App\Enums\MaintenanceStatus;
use App\Enums\MaintenanceType;
use App\Enums\PrinterStatus;
use App\Models\Article;
use App\Models\ArticleUsed;
use App\Models\MaintenanceOrder;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\PrinterBrand;
use App\Models\PrinterModel;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenanceAnalyticsTest extends TestCase
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

    private function createCompletedOrder(
        Printer $printer,
        User $socio,
        string $tipoMantto,
        array $overrides = [],
    ): MaintenanceOrder {
        return MaintenanceOrder::create(array_merge([
            'impresora_id' => $printer->id,
            'fecha' => today(),
            'tipo_mantto' => $tipoMantto,
            'desc_problema' => 'Problema de prueba',
            'tipo_problema' => $tipoMantto === MaintenanceType::CORRECTIVO->value ? 'ATASCOS' : null,
            'severidad' => 'MEDIA',
            'estado' => MaintenanceStatus::COMPLETADA,
            'socio_id' => $socio->id,
            'costo_mano_obra' => 100,
            'costo_total' => 100,
            'fecha_creacion' => now()->subDays(3),
            'fecha_completado' => now(),
        ], $overrides));
    }

    private function attachArticle(MaintenanceOrder $order, Article $article, int $cantidad, float $costoUnitario): ArticleUsed
    {
        return ArticleUsed::create([
            'articulo_id' => $article->id,
            'orden_mantto_id' => $order->id,
            'cantidad' => $cantidad,
            'costo_unitario' => $costoUnitario,
            'subtotal' => $cantidad * $costoUnitario,
        ]);
    }

    public function test_stats_default_mes_corriente_mantiene_claves_actuales(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);

        $this->createCompletedOrder($printer, $admin, 'CORRECTIVO', [
            'costo_mano_obra' => 300,
            'costo_total' => 300,
        ]);

        $this->createCompletedOrder($printer, $admin, 'PREVENTIVO', [
            'costo_mano_obra' => 500,
            'costo_total' => 500,
        ]);

        // Fuera del mes corriente: no debe contarse.
        $this->createCompletedOrder($printer, $admin, 'CORRECTIVO', [
            'costo_mano_obra' => 9999,
            'costo_total' => 9999,
            'fecha_creacion' => now()->subMonths(3),
            'fecha_completado' => now()->subMonths(2),
        ]);

        $stats = $this->getJson('/api/v1/maintenance-orders/stats')->assertOk();

        $this->assertSame(0, $stats->json('abiertas'));
        $this->assertSame(2, (int) $stats->json('completadas_mes'));
        $this->assertSame(800.0, (float) $stats->json('costo_mes'));
        $this->assertSame(50.0, (float) $stats->json('pct_correctivas'));

        // Desgloses nuevos presentes.
        $this->assertIsArray($stats->json('por_socio'));
        $this->assertIsArray($stats->json('por_tipo_problema'));
        $this->assertSame(1, (int) $stats->json('por_tipo_mantto.PREVENTIVO'));
        $this->assertSame(1, (int) $stats->json('por_tipo_mantto.CORRECTIVO'));
        $this->assertIsNumeric($stats->json('mttr_dias'));
    }

    public function test_stats_con_rango_custom(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);

        $antigua = $this->createCompletedOrder($printer, $admin, 'CORRECTIVO', [
            'costo_total' => 1000,
            'fecha_creacion' => now()->subMonths(3),
            'fecha_completado' => now()->subMonths(2)->startOfDay(),
        ]);

        $this->createCompletedOrder($printer, $admin, 'CORRECTIVO', [
            'costo_total' => 200,
            'fecha_creacion' => now()->subDays(3),
            'fecha_completado' => now(),
        ]);

        $stats = $this->getJson('/api/v1/maintenance-orders/stats?' . http_build_query([
            'fecha_desde' => now()->subMonths(3)->toDateString(),
            'fecha_hasta' => now()->subMonths(2)->toDateString(),
        ]))->assertOk();

        $this->assertSame(1, (int) $stats->json('completadas_mes'));
        $this->assertSame(1000.0, (float) $stats->json('costo_mes'));
    }

    public function test_stats_desglose_por_socio_y_tipo(): void
    {
        $admin = $this->adminUser();
        $tecnico = $this->userWithPermissions(['inventario.mantenimiento']);
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);

        $this->createCompletedOrder($printer, $admin, 'CORRECTIVO', ['costo_total' => 300]);
        $this->createCompletedOrder($printer, $admin, 'PREVENTIVO', ['costo_total' => 500]);
        $this->createCompletedOrder($printer, $tecnico, 'CORRECTIVO', [
            'tipo_problema' => 'NO_IMPRIME',
            'costo_total' => 700,
        ]);

        $stats = $this->getJson('/api/v1/maintenance-orders/stats')->assertOk();

        $porSocio = collect($stats->json('por_socio'));
        $this->assertCount(2, $porSocio);

        $filaAdmin = $porSocio->firstWhere('socio_id', $admin->id);
        $this->assertSame(2, $filaAdmin['completadas']);
        $this->assertSame(800.0, (float) $filaAdmin['costo_manejado']);

        $filaTecnico = $porSocio->firstWhere('socio_id', $tecnico->id);
        $this->assertSame(1, $filaTecnico['completadas']);
        $this->assertSame(700.0, (float) $filaTecnico['costo_manejado']);

        // Por tipo de problema solo cuenta CORRECTIVO.
        $porProblema = collect($stats->json('por_tipo_problema'));
        $this->assertSame(2, $porProblema->count());
        $this->assertSame(1, (int) $porProblema->firstWhere('tipo_problema', 'NO_IMPRIME')['total']);

        // Filtro por socio.
        $statsSocio = $this->getJson('/api/v1/maintenance-orders/stats?socio_id=' . $tecnico->id)->assertOk();

        $this->assertSame(1, (int) $statsSocio->json('completadas_mes'));
        $this->assertCount(1, $statsSocio->json('por_socio'));
    }

    public function test_stats_mttr_con_duraciones_conocidas(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);

        // 4 días y 2 días → promedio 3 días.
        $this->createCompletedOrder($printer, $admin, 'CORRECTIVO', [
            'fecha_creacion' => now()->subDays(9)->startOfDay(),
            'fecha_completado' => now()->subDays(5)->startOfDay(),
        ]);

        $this->createCompletedOrder($printer, $admin, 'CORRECTIVO', [
            'fecha_creacion' => now()->subDays(9)->startOfDay(),
            'fecha_completado' => now()->subDays(7)->startOfDay(),
        ]);

        $stats = $this->getJson('/api/v1/maintenance-orders/stats')->assertOk();

        $this->assertEqualsWithDelta(3.0, (float) $stats->json('mttr_dias'), 0.05);
    }

    public function test_top_articles_agrega_y_filtra_por_tipo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);

        $fusor = Article::create([
            'tipo_articulo' => ArticleType::REPARACION,
            'subtipo' => 'Pieza',
            'nombre' => 'Fusor',
            'modelo_sku' => 'SKU-F-' . uniqid(),
            'stock_actual' => 10,
            'umbral_reposicion' => 2,
            'costo_unitario' => 250,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        $toner = Article::create([
            'tipo_articulo' => ArticleType::CONSUMIBLE,
            'subtipo' => 'Toner',
            'nombre' => 'Toner 26A',
            'modelo_sku' => 'SKU-T-' . uniqid(),
            'stock_actual' => 10,
            'umbral_reposicion' => 2,
            'costo_unitario' => 100,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        $orden1 = $this->createCompletedOrder($printer, $admin, 'CORRECTIVO');
        $orden2 = $this->createCompletedOrder($printer, $admin, 'CORRECTIVO');

        $this->attachArticle($orden1, $fusor, 1, 250);
        $this->attachArticle($orden2, $fusor, 1, 250);
        $this->attachArticle($orden1, $toner, 2, 100);

        // Artículo en orden PROGRAMADA: no debe aparecer.
        $programada = MaintenanceOrder::create([
            'impresora_id' => $printer->id,
            'fecha' => today(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Abierta',
            'estado' => MaintenanceStatus::PROGRAMADA,
            'socio_id' => $admin->id,
            'costo_total' => 0,
            'fecha_creacion' => now(),
        ]);
        $this->attachArticle($programada, $toner, 5, 100);

        $response = $this->getJson('/api/v1/reports/maintenance/top-articles')->assertOk();
        $top = $response->json('top');

        $filaFusor = collect($top)->firstWhere('articulo_id', $fusor->id);
        $this->assertNotNull($filaFusor);
        $this->assertSame(2, $filaFusor['total_cantidad']);
        $this->assertSame(500.0, (float) $filaFusor['total_costo']);

        $filaToner = collect($top)->firstWhere('articulo_id', $toner->id);
        $this->assertNotNull($filaToner);
        $this->assertSame(2, $filaToner['total_cantidad']);
        $this->assertSame(200.0, (float) $filaToner['total_costo']);

        $soloReparacionesResponse = $this->getJson('/api/v1/reports/maintenance/top-articles?tipo_articulo=REPARACION')->assertOk();
        $soloReparaciones = $soloReparacionesResponse->json('top');

        $this->assertNotNull(collect($soloReparaciones)->firstWhere('articulo_id', $fusor->id));
        $this->assertNull(collect($soloReparaciones)->firstWhere('articulo_id', $toner->id));

        // Desglose por origen (snapshot): ambas filas de fusor sin origen.
        $porOrigen = $response->json('por_origen');
        $this->assertArrayHasKey('SIN_ESPECIFICAR', $porOrigen);
        $this->assertSame(700.0, (float) $porOrigen['SIN_ESPECIFICAR']['total_costo']);
    }

    public function test_failures_agrupa_por_problema_y_modelo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printerA = $this->createPrinter($admin);
        $printerB = $this->createPrinter($admin);

        $pieza = Article::create([
            'tipo_articulo' => ArticleType::REPARACION,
            'subtipo' => 'Pieza',
            'nombre' => 'Rodillo',
            'modelo_sku' => 'SKU-R-' . uniqid(),
            'stock_actual' => 10,
            'umbral_reposicion' => 2,
            'costo_unitario' => 50,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        $ordenA = $this->createCompletedOrder($printerA, $admin, 'CORRECTIVO', [
            'tipo_problema' => 'ATASCOS',
        ]);
        $ordenA2 = $this->createCompletedOrder($printerA, $admin, 'CORRECTIVO', [
            'tipo_problema' => 'ATASCOS',
        ]);
        $ordenB = $this->createCompletedOrder($printerB, $admin, 'CORRECTIVO', [
            'tipo_problema' => 'NO_IMPRIME',
        ]);

        // Preventiva: excluida del ranking.
        $this->createCompletedOrder($printerA, $admin, 'PREVENTIVO');

        $this->attachArticle($ordenA, $pieza, 2, 50);
        $this->attachArticle($ordenA2, $pieza, 1, 50);

        $response = $this->getJson('/api/v1/reports/maintenance/failures')->assertOk()->json();

        $ranking = collect($response['ranking']);

        $mecanicoA = $ranking->first(fn ($r) => $r['tipo_problema'] === 'ATASCOS' && $r['modelo_id'] === $printerA->printer_model_id);
        $this->assertNotNull($mecanicoA);
        $this->assertSame(2, $mecanicoA['total']);

        $electricoB = $ranking->first(fn ($r) => $r['tipo_problema'] === 'NO_IMPRIME' && $r['modelo_id'] === $printerB->printer_model_id);
        $this->assertNotNull($electricoB);
        $this->assertSame(1, $electricoB['total']);

        // Dos filas: ATASCOS×modeloA (total 2) y NO_IMPRIME×modeloB (total 1);
        // la preventiva no aparece en el ranking.
        $this->assertSame(2, $ranking->count());

        $piezas = $response['piezas_asociadas'];
        $this->assertArrayHasKey('ATASCOS', $piezas);
        $this->assertSame($pieza->id, $piezas['ATASCOS'][0]['articulo_id']);
        $this->assertSame(3, (int) $piezas['ATASCOS'][0]['total_cantidad']);
        $this->assertSame(150.0, (float) $piezas['ATASCOS'][0]['total_costo']);
    }

    public function test_endpoints_requieren_permiso_de_mantenimiento(): void
    {
        $sinPermiso = $this->userWithPermissions([]);
        Sanctum::actingAs($sinPermiso);

        $this->getJson('/api/v1/maintenance-orders/stats')->assertForbidden();
        $this->getJson('/api/v1/reports/maintenance/top-articles')->assertForbidden();
        $this->getJson('/api/v1/reports/maintenance/failures')->assertForbidden();
    }
}
