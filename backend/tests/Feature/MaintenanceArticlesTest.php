<?php

namespace Tests\Feature;

use App\Enums\ArticleType;
use App\Enums\PrinterStatus;
use App\Models\Article;
use App\Models\InventoryMovement;
use App\Models\Printer;
use App\Models\Role;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenanceArticlesTest extends TestCase
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
            'estado' => PrinterStatus::EN_ALMACEN,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    private function createArticle(int $stock, float $costo = 25.0, array $overrides = []): Article
    {
        return Article::create(array_merge([
            'tipo_articulo' => ArticleType::REPARACION,
            'subtipo' => 'Pieza',
            'nombre' => 'Fusor ' . uniqid(),
            'marca' => 'HP',
            'modelo_sku' => 'SKU-' . uniqid(),
            'stock_actual' => $stock,
            'umbral_reposicion' => 2,
            'costo_unitario' => $costo,
            'activo' => true,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    private function createOrder(User $admin, Printer $printer, array $overrides = []): int
    {
        return $this->postJson('/api/v1/maintenance-orders', array_merge([
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'No imprime',
        ], $overrides))
            ->assertCreated()
            ->json('id');
    }

    private function addArticle(int $orderId, int $articleId, int $qty)
    {
        return $this->postJson("/api/v1/maintenance-orders/{$orderId}/articles", [
            'articulo_id' => $articleId,
            'cantidad' => $qty,
        ]);
    }

    public function test_add_article_con_stock_insuficiente_es_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);
        $article = $this->createArticle(5);

        $this->addArticle($orderId, $article->id, 6)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Stock insuficiente: disponible 5, solicitado 6');

        $this->assertDatabaseCount('articles_used', 0);
    }

    public function test_segunda_fila_del_mismo_articulo_que_excede_stock_es_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);
        $article = $this->createArticle(5);

        $this->addArticle($orderId, $article->id, 3)->assertCreated();

        // 3 (ya en orden) + 3 (nueva) = 6 > 5 disponible.
        $this->addArticle($orderId, $article->id, 3)->assertStatus(422);

        $this->assertSame(1, \App\Models\ArticleUsed::where('orden_mantto_id', $orderId)->count());
    }

    public function test_add_article_con_stock_exacto_ok(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);
        $article = $this->createArticle(5);

        $this->addArticle($orderId, $article->id, 5)->assertCreated();

        $this->assertSame(5, (int) \App\Models\ArticleUsed::where('orden_mantto_id', $orderId)->sum('cantidad'));
    }

    public function test_complete_descarga_kardex_y_cuadra_costo_total_con_snapshot(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer, ['costo_mano_obra' => 100]);
        $article = $this->createArticle(5, 25.0);

        $this->addArticle($orderId, $article->id, 2)->assertCreated();

        // El costo cambia DESPUÉS del alta: el snapshot ya está congelado.
        $article->update(['costo_unitario' => 40.0]);

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Cambio de fusor',
            'costo_mano_obra' => 100,
        ])->assertOk();

        $this->assertSame(150.0, (float) \App\Models\MaintenanceOrder::findOrFail($orderId)->costo_total);

        // Kardex: salida con referencia a la orden y stock decrementado.
        $this->assertDatabaseHas('inventory_movements', [
            'articulo_id' => $article->id,
            'tipo_movimiento' => 'SALIDA',
            'cantidad' => 2,
            'stock_anterior' => 5,
            'stock_posterior' => 3,
            'referencia_tipo' => 'MaintenanceOrder',
            'referencia_id' => $orderId,
        ]);

        $this->assertDatabaseHas('articles', ['id' => $article->id, 'stock_actual' => 3]);
    }

    public function test_cancel_elimina_piezas_sin_movimientos_de_kardex(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);
        $article = $this->createArticle(5);

        $this->addArticle($orderId, $article->id, 2)->assertCreated();

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/cancel")->assertOk();

        $this->assertDatabaseMissing('articles_used', ['orden_mantto_id' => $orderId]);
        $this->assertDatabaseHas('articles', ['id' => $article->id, 'stock_actual' => 5]);
        $this->assertSame(
            0,
            InventoryMovement::where('referencia_tipo', 'MaintenanceOrder')->count()
        );
    }

    public function test_complete_con_stock_insuficiente_revierte_todo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);
        $article = $this->createArticle(5);

        $this->addArticle($orderId, $article->id, 4)->assertCreated();

        // El stock baja por un ajuste externo después del alta.
        app(InventoryService::class)->registerAdjustment($article, 1, $admin, 'Ajuste externo');

        $this->postJson("/api/v1/maintenance-orders/{$orderId}/complete", [
            'trabajo_realizado' => 'Reparado',
            'costo_mano_obra' => 100,
        ])->assertStatus(422);

        // La orden sigue PROGRAMADA y no quedó kardex parcial.
        $this->assertDatabaseHas('maintenance_orders', [
            'id' => $orderId,
            'estado' => 'PROGRAMADA',
        ]);
        $this->assertSame(
            0,
            InventoryMovement::where('referencia_tipo', 'MaintenanceOrder')->where('referencia_id', $orderId)->count()
        );
    }

    public function test_remove_article_en_programada_elimina_fila(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);
        $orderId = $this->createOrder($admin, $printer);
        $article = $this->createArticle(5);

        $this->addArticle($orderId, $article->id, 2)->assertCreated();
        $articleUsedId = \App\Models\ArticleUsed::where('orden_mantto_id', $orderId)->first()->id;

        $this->deleteJson("/api/v1/maintenance-orders/{$orderId}/articles/{$articleUsedId}")
            ->assertOk();

        $this->assertDatabaseMissing('articles_used', ['id' => $articleUsedId]);
    }
}
