<?php

namespace Tests\Feature;

use App\Enums\ArticleType;
use App\Enums\MovementType;
use App\Models\Article;
use App\Models\InventoryMovement;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ManualStockMovementTest extends TestCase
{
    use RefreshDatabase;

    private function adminUser(): User
    {
        $role = Role::create([
            'nombre' => 'Admin Test',
            'slug' => 'admin-test',
            'es_sistema' => true,
        ]);

        $user = User::create([
            'nombre' => 'Admin Test',
            'correo' => 'admin@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0100',
            'rol_id' => $role->id,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        return $user;
    }

    private function createArticle(int $stock = 10, int $umbral = 2): Article
    {
        return Article::create([
            'tipo_articulo' => ArticleType::CONSUMIBLE,
            'nombre' => 'Tóner Test',
            'marca' => 'HP',
            'modelo_sku' => '85A',
            'stock_actual' => $stock,
            'umbral_reposicion' => $umbral,
            'costo_unitario' => 50.00,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    public function test_registra_entrada_manual(): void
    {
        Sanctum::actingAs($this->adminUser());
        $article = $this->createArticle(10);

        $response = $this->postJson("/api/v1/articles/{$article->id}/movements", [
            'tipo_movimiento' => 'ENTRADA',
            'cantidad' => 5,
            'justificacion' => 'Ingreso manual por compra local',
        ]);

        $response->assertCreated()
            ->assertJsonPath('tipo_movimiento', 'ENTRADA')
            ->assertJsonPath('cantidad', 5)
            ->assertJsonPath('stock_anterior', 10)
            ->assertJsonPath('stock_posterior', 15);

        $this->assertEquals(15, $article->fresh()->stock_actual);
        $this->assertDatabaseHas('inventory_movements', [
            'articulo_id' => $article->id,
            'tipo_movimiento' => MovementType::ENTRADA->value,
            'referencia_tipo' => 'AJUSTE_MANUAL',
        ]);
    }

    public function test_registra_salida_manual(): void
    {
        Sanctum::actingAs($this->adminUser());
        $article = $this->createArticle(10);

        $response = $this->postJson("/api/v1/articles/{$article->id}/movements", [
            'tipo_movimiento' => 'SALIDA',
            'cantidad' => 4,
            'justificacion' => 'Salida por merma detectada',
        ]);

        $response->assertCreated()
            ->assertJsonPath('tipo_movimiento', 'SALIDA')
            ->assertJsonPath('stock_posterior', 6);

        $this->assertEquals(6, $article->fresh()->stock_actual);
    }

    public function test_salida_con_stock_insuficiente_devuelve_422(): void
    {
        Sanctum::actingAs($this->adminUser());
        $article = $this->createArticle(3);

        $response = $this->postJson("/api/v1/articles/{$article->id}/movements", [
            'tipo_movimiento' => 'SALIDA',
            'cantidad' => 10,
            'justificacion' => 'Intento de salida excesiva',
        ]);

        $response->assertStatus(422);
        $this->assertEquals(3, $article->fresh()->stock_actual);
    }

    public function test_registra_ajuste_absoluto(): void
    {
        Sanctum::actingAs($this->adminUser());
        $article = $this->createArticle(10);

        $response = $this->postJson("/api/v1/articles/{$article->id}/movements", [
            'tipo_movimiento' => 'AJUSTE',
            'stock_destino' => 7,
            'justificacion' => 'Conteo físico de fin de mes',
        ]);

        $response->assertCreated()
            ->assertJsonPath('tipo_movimiento', 'AJUSTE')
            ->assertJsonPath('stock_posterior', 7)
            ->assertJsonPath('cantidad', 3)
            ->assertJsonPath('referencia_tipo', 'AJUSTE_MANUAL');

        $this->assertEquals(7, $article->fresh()->stock_actual);
    }

    public function test_validacion_rechaza_justificacion_vacia(): void
    {
        Sanctum::actingAs($this->adminUser());
        $article = $this->createArticle(10);

        $response = $this->postJson("/api/v1/articles/{$article->id}/movements", [
            'tipo_movimiento' => 'ENTRADA',
            'cantidad' => 5,
            'justificacion' => '',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['justificacion']);
    }
}
