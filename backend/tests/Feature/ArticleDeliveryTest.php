<?php

namespace Tests\Feature;

use App\Enums\ArticleType;
use App\Enums\ContractStatus;
use App\Enums\VisitFrequency;
use App\Enums\VisitStatus;
use App\Enums\VisitType;
use App\Models\Article;
use App\Models\Client;
use App\Models\Contract;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ArticleDeliveryTest extends TestCase
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

    private function createArticle(int $stock = 10): Article
    {
        return Article::create([
            'tipo_articulo' => ArticleType::CONSUMIBLE,
            'subtipo' => 'TONER',
            'nombre' => 'Tóner Test',
            'marca' => 'HP',
            'modelo_sku' => '85A',
            'stock_actual' => $stock,
            'umbral_reposicion' => 2,
            'costo_unitario' => 50.00,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function createVisit(User $user, array $overrides = []): Visit
    {
        $client = Client::create([
            'razon_social' => 'Cliente Delivery SA',
            'rfc' => 'CDS' . substr(md5(uniqid()), 0, 7),
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

        return Visit::create(array_merge([
            'cliente_id' => $client->id,
            'contrato_id' => $contract->id,
            'tipo_visita' => VisitType::ENTREGA_INSUMOS,
            'fecha_programada' => today(),
            'socio_id' => $user->id,
            'estado' => VisitStatus::PENDIENTE,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ], $overrides));
    }

    public function test_entrega_insumo_decrementa_stock_y_registra_movimiento(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $article = $this->createArticle(10);
        $visit = $this->createVisit($admin);

        $response = $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 4,
        ]);

        $response->assertCreated()
            ->assertJsonPath('articulo_id', $article->id)
            ->assertJsonPath('visita_id', $visit->id)
            ->assertJsonPath('cantidad', 4)
            ->assertJsonPath('article.nombre', 'Tóner Test');

        $this->assertEquals(6, $article->fresh()->stock_actual);

        $deliveryId = $response->json('id');
        $this->assertDatabaseHas('article_deliveries', [
            'id' => $deliveryId,
            'articulo_id' => $article->id,
            'visita_id' => $visit->id,
            'contrato_id' => $visit->contrato_id,
            'cliente_id' => $visit->cliente_id,
            'cantidad' => 4,
            'costo_unitario' => 50.00,
            'subtotal' => 200.00,
            'socio_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('inventory_movements', [
            'articulo_id' => $article->id,
            'tipo_movimiento' => 'SALIDA',
            'cantidad' => 4,
            'stock_anterior' => 10,
            'stock_posterior' => 6,
            'referencia_tipo' => 'ARTICLE_DELIVERY',
            'referencia_id' => $deliveryId,
        ]);
    }

    public function test_stock_insuficiente_devuelve_422(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $article = $this->createArticle(3);
        $visit = $this->createVisit($admin);

        $response = $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 10,
        ]);

        $response->assertStatus(422)->assertJsonPath('message', 'Stock insuficiente para Tóner Test. Stock actual: 3, solicitado: 10');
        $this->assertEquals(3, $article->fresh()->stock_actual);
        $this->assertDatabaseMissing('article_deliveries', ['visita_id' => $visit->id]);
    }

    public function test_permite_entrega_en_visita_de_cualquier_tipo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $article = $this->createArticle(10);
        $visit = $this->createVisit($admin, ['tipo_visita' => VisitType::LECTURA]);

        $response = $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 2,
        ]);

        $response->assertCreated()
            ->assertJsonPath('visita_id', $visit->id)
            ->assertJsonPath('cantidad', 2);
        $this->assertEquals(8, $article->fresh()->stock_actual);
    }

    public function test_rechaza_visita_completada(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $article = $this->createArticle(10);
        $visit = $this->createVisit($admin, ['estado' => VisitStatus::COMPLETADA]);

        $response = $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 1,
        ]);

        $response->assertStatus(422)->assertJsonPath('message', 'Solo se pueden entregar insumos en visitas pendientes o reprogramadas');
        $this->assertEquals(10, $article->fresh()->stock_actual);
    }

    public function test_rechaza_articulo_inactivo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $article = $this->createArticle(10);
        $article->update(['activo' => false]);
        $visit = $this->createVisit($admin);

        $response = $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 1,
        ]);

        $response->assertStatus(422);
        $this->assertEquals(10, $article->fresh()->stock_actual);
    }

    public function test_permite_entregas_multiples_del_mismo_articulo(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $article = $this->createArticle(10);
        $visit = $this->createVisit($admin);

        $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 2,
        ])->assertCreated();

        $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 3,
        ])->assertCreated();

        $this->assertEquals(5, $article->fresh()->stock_actual);
        $this->assertEquals(2, $visit->deliveries()->count());
    }

    public function test_lista_entregas_de_la_visita(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $article = $this->createArticle(10);
        $visit = $this->createVisit($admin);

        $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 2,
        ])->assertCreated();

        $list = $this->getJson("/api/v1/visits/{$visit->id}/deliveries");
        $list->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.articulo_id', $article->id)
            ->assertJsonPath('data.0.article.nombre', 'Tóner Test');

        $show = $this->getJson("/api/v1/visits/{$visit->id}");
        $show->assertOk()->assertJsonPath('entregas.0.articulo_id', $article->id);
    }

    public function test_requiere_permiso_inventario_articulos(): void
    {
        $soloOperaciones = $this->userWithPermissions(['operaciones.calendario']);
        Sanctum::actingAs($soloOperaciones);

        $article = $this->createArticle(10);
        $visit = $this->createVisit($soloOperaciones);

        $this->postJson("/api/v1/visits/{$visit->id}/deliver-article", [
            'articulo_id' => $article->id,
            'cantidad' => 1,
        ])->assertStatus(403);

        $this->getJson("/api/v1/visits/{$visit->id}/deliveries")->assertStatus(403);

        $this->assertEquals(10, $article->fresh()->stock_actual);
    }
}
