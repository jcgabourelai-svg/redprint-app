<?php

namespace Tests\Feature;

use App\Enums\ArticleType;
use App\Enums\MaintenanceStatus;
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

class ArticleOriginTest extends TestCase
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

    private function createArticle(array $overrides = []): Article
    {
        return Article::create(array_merge([
            'tipo_articulo' => ArticleType::REPARACION,
            'subtipo' => 'Pieza',
            'nombre' => 'Fusor Test',
            'modelo_sku' => 'SKU-' . uniqid(),
            'stock_actual' => 10,
            'umbral_reposicion' => 2,
            'costo_unitario' => 100,
            'activo' => true,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    public function test_snapshot_se_congela_al_agregar_pieza(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);
        $article = $this->createArticle(['origen' => 'ORIGINAL']);

        $orderId = $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Falla',
            'severidad' => 'MEDIA',
        ])->assertCreated()->json('id');

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/articles", [
            'articulo_id' => $article->id,
            'cantidad' => 1,
        ])->assertCreated();

        $fila = ArticleUsed::where('orden_mantto_id', $orderId)
            ->where('articulo_id', $article->id)
            ->first();

        $this->assertSame('ORIGINAL', $fila->origen_snapshot?->value);

        // Reclasificar el artículo NO altera el snapshot de la orden.
        $article->update(['origen' => 'COMPATIBLE']);

        $this->assertSame('ORIGINAL', $fila->fresh()->origen_snapshot?->value);
        $this->assertSame('COMPATIBLE', $article->fresh()->origen?->value);

        // Artículo legacy sin origen: snapshot null.
        $legacy = $this->createArticle(['nombre' => 'Legacy sin origen']);
        $this->postJson("/api/v1/maintenance-orders/{$orderId}/articles", [
            'articulo_id' => $legacy->id,
            'cantidad' => 1,
        ])->assertCreated();

        $filaLegacy = ArticleUsed::where('orden_mantto_id', $orderId)
            ->where('articulo_id', $legacy->id)
            ->first();
        $this->assertNull($filaLegacy->origen_snapshot);
    }

    public function test_reporte_top_articles_desglosa_por_origen(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);
        $original = $this->createArticle(['origen' => 'ORIGINAL', 'costo_unitario' => 100, 'nombre' => 'Original']);
        $refaccionada = $this->createArticle(['origen' => 'REFACCIONADA', 'costo_unitario' => 50, 'nombre' => 'Refaccionada']);
        $sinOrigen = $this->createArticle(['costo_unitario' => 20, 'nombre' => 'Sin origen']);

        $order = MaintenanceOrder::create([
            'impresora_id' => $printer->id,
            'fecha' => today(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Falla',
            'estado' => MaintenanceStatus::COMPLETADA,
            'socio_id' => $admin->id,
            'costo_total' => 0,
            'fecha_creacion' => now()->subDays(2),
            'fecha_completado' => now(),
        ]);

        ArticleUsed::create(['articulo_id' => $original->id, 'orden_mantto_id' => $order->id, 'cantidad' => 2, 'costo_unitario' => 100, 'subtotal' => 200, 'origen_snapshot' => 'ORIGINAL']);
        ArticleUsed::create(['articulo_id' => $refaccionada->id, 'orden_mantto_id' => $order->id, 'cantidad' => 1, 'costo_unitario' => 50, 'subtotal' => 50, 'origen_snapshot' => 'REFACCIONADA']);
        ArticleUsed::create(['articulo_id' => $sinOrigen->id, 'orden_mantto_id' => $order->id, 'cantidad' => 3, 'costo_unitario' => 20, 'subtotal' => 60, 'origen_snapshot' => null]);

        $response = $this->getJson('/api/v1/reports/maintenance/top-articles')->assertOk();

        $porOrigen = $response->json('por_origen');
        $this->assertSame(200.0, (float) $porOrigen['ORIGINAL']['total_costo']);
        $this->assertSame(2, (int) $porOrigen['ORIGINAL']['total_cantidad']);
        $this->assertSame(50.0, (float) $porOrigen['REFACCIONADA']['total_costo']);
        $this->assertSame(60.0, (float) $porOrigen['SIN_ESPECIFICAR']['total_costo']);
        $this->assertSame(3, (int) $porOrigen['SIN_ESPECIFICAR']['total_cantidad']);
    }

    public function test_valida_origen_invalido_con_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/articles', [
            'tipo_articulo' => 'REPARACION',
            'nombre' => 'Pieza test',
            'costo_unitario' => 100,
            'origen' => 'INVALIDO',
        ])->assertStatus(422);
    }

    public function test_extract_part_asigna_origen_refaccionada_por_defecto(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $printer = $this->createPrinter($admin);
        $printer->update(['condicion' => 'PIEZAS']);

        $response = $this->postJson("/api/v1/printers/{$printer->id}/extract-part", [
            'nombre_nuevo' => 'Fusor donado',
            'tipo_articulo' => 'REPARACION',
            'cantidad' => 1,
        ])->assertCreated();

        $this->assertSame('REFACCIONADA', Article::find($response->json('id'))->origen?->value);

        // Origen explícito respeta la indicación del operador.
        $response2 = $this->postJson("/api/v1/printers/{$printer->id}/extract-part", [
            'nombre_nuevo' => 'Rodillo donado',
            'tipo_articulo' => 'REPARACION',
            'cantidad' => 1,
            'origen' => 'ORIGINAL',
        ])->assertCreated();

        $this->assertSame('ORIGINAL', Article::find($response2->json('id'))->origen?->value);
    }
}
