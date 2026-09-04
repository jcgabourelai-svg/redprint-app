<?php

namespace Tests\Feature;

use App\Enums\ArticleType;
use App\Enums\PrinterStatus;
use App\Models\Article;
use App\Models\Printer;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenanceStatsAndCompatibilityTest extends TestCase
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

    private function createPrinter(User $user): array
    {
        $brand = \App\Models\PrinterBrand::create([
            'nombre' => 'HP',
            'slug' => 'hp-' . substr(md5(uniqid()), 0, 6),
        ]);

        $model = \App\Models\PrinterModel::create([
            'brand_id' => $brand->id,
            'nombre' => 'LaserJet Test ' . substr(md5(uniqid()), 0, 6),
        ]);

        $printer = Printer::create([
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

        return [$printer, $model];
    }

    private function createOrder(User $admin, Printer $printer, string $tipo): int
    {
        return $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => $tipo,
            'desc_problema' => 'Problema',
        ])->assertCreated()->json('id');
    }

    public function test_stats_cuadran_con_fixtures(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$printer1] = $this->createPrinter($admin);
        [$printer2] = $this->createPrinter($admin);
        [$printer3] = $this->createPrinter($admin);

        $correctiva1 = $this->createOrder($admin, $printer1, 'CORRECTIVO');
        $correctiva2 = $this->createOrder($admin, $printer2, 'CORRECTIVO');
        $preventivo = $this->createOrder($admin, $printer3, 'PREVENTIVO');

        $stats = $this->getJson('/api/v1/maintenance-orders/stats')->assertOk();

        $this->assertSame(3, $stats->json('abiertas'));
        $this->assertSame(0, (int) $stats->json('completadas_mes'));
        $this->assertSame(0.0, (float) $stats->json('costo_mes'));
        $this->assertSame(0.0, (float) $stats->json('pct_correctivas'));

        $this->postJson("/api/v1/maintenance-orders/{$preventivo}/complete", [
            'trabajo_realizado' => 'Mantenimiento anual',
            'costo_mano_obra' => 500,
        ])->assertOk();

        $this->postJson("/api/v1/maintenance-orders/{$correctiva1}/complete", [
            'trabajo_realizado' => 'Cambio de fusor',
            'costo_mano_obra' => 300,
        ])->assertOk();

        $stats = $this->getJson('/api/v1/maintenance-orders/stats')->assertOk();

        $this->assertSame(1, $stats->json('abiertas'));
        $this->assertSame(2, (int) $stats->json('completadas_mes'));
        $this->assertSame(800.0, (float) $stats->json('costo_mes'));
        $this->assertSame(50.0, (float) $stats->json('pct_correctivas'));
    }

    public function test_compatible_articles_respeta_pivote(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        [$printer, $model] = $this->createPrinter($admin);

        $compatible = Article::create([
            'tipo_articulo' => ArticleType::REPARACION,
            'subtipo' => 'Pieza',
            'nombre' => 'Fusor compatible',
            'marca' => 'HP',
            'modelo_sku' => 'SKU-C-' . uniqid(),
            'stock_actual' => 7,
            'umbral_reposicion' => 2,
            'costo_unitario' => 250,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        $incompatible = Article::create([
            'tipo_articulo' => ArticleType::REPARACION,
            'subtipo' => 'Pieza',
            'nombre' => 'Fusor de otra marca',
            'marca' => 'Epson',
            'modelo_sku' => 'SKU-X-' . uniqid(),
            'stock_actual' => 9,
            'umbral_reposicion' => 2,
            'costo_unitario' => 300,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        $compatible->modelosCompatibles()->attach($model->id);

        $response = $this->getJson("/api/v1/printers/{$printer->id}/compatible-articles");

        $response->assertOk();

        $ids = collect($response->json())->pluck('id');

        $this->assertContains($compatible->id, $ids);
        $this->assertNotContains($incompatible->id, $ids);

        $fila = collect($response->json())->firstWhere('id', $compatible->id);
        $this->assertSame(7, $fila['stock_actual']);
        $this->assertEquals(250, (float) $fila['costo_unitario']);
    }
}
