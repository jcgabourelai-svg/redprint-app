<?php

namespace Tests\Feature;

use App\Enums\ArticleType;
use App\Enums\PrinterStatus;
use App\Models\Article;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\Role;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MaintenanceCriticalNotificationTest extends TestCase
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

    private function userWithPermission(string $clave): User
    {
        $role = Role::create([
            'nombre' => 'Rol ' . $clave . ' ' . uniqid(),
            'slug' => 'rol-' . uniqid(),
            'es_sistema' => false,
        ]);

        $role->permissions()->attach(
            Permission::where('clave', $clave)->firstOrFail()->id
        );

        return User::create([
            'nombre' => 'User ' . $clave,
            'correo' => uniqid() . '@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0300',
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
            'estado' => PrinterStatus::RENTADA,
            'creado_por' => $user->id,
            'fecha_creacion' => now(),
        ]);
    }

    public function test_orden_critica_notifica_solo_a_usuarios_con_permiso(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);

        $conPermiso = $this->userWithPermission('inventario.mantenimiento');
        $sinPermiso = $this->userWithPermission('clientes');

        $printer = $this->createPrinter($admin);

        $response = $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Ardió la fuente de poder',
            'severidad' => 'CRITICA',
        ])->assertCreated();

        $orderId = $response->json('id');

        // El admin (sistema) y el usuario con el permiso: una notificación cada uno.
        $this->assertDatabaseHas('notifications', [
            'usuario_id' => $admin->id,
            'tipo' => 'MAINTENANCE_CRITICAL',
            'referencia_tipo' => 'MaintenanceOrder',
            'referencia_id' => $orderId,
            'leida' => false,
        ]);
        $this->assertDatabaseHas('notifications', [
            'usuario_id' => $conPermiso->id,
            'tipo' => 'MAINTENANCE_CRITICAL',
            'referencia_id' => $orderId,
        ]);
        $this->assertDatabaseMissing('notifications', [
            'usuario_id' => $sinPermiso->id,
            'tipo' => 'MAINTENANCE_CRITICAL',
        ]);

        $this->assertSame(
            2,
            \App\Models\Notification::where('tipo', 'MAINTENANCE_CRITICAL')->where('referencia_id', $orderId)->count()
        );

        $notificacion = \App\Models\Notification::where('tipo', 'MAINTENANCE_CRITICAL')
            ->where('referencia_id', $orderId)
            ->first();
        $this->assertSame('Falla crítica reportada', $notificacion->titulo);
        $this->assertStringContainsString('HP LaserJet Test', $notificacion->mensaje);
        $this->assertStringContainsString('Ardió la fuente', $notificacion->mensaje);
    }

    public function test_orden_no_critica_no_genera_notificaciones(): void
    {
        $admin = $this->adminUser();
        Sanctum::actingAs($admin);
        $printer = $this->createPrinter($admin);

        $this->postJson('/api/v1/maintenance-orders', [
            'impresora_id' => $printer->id,
            'fecha' => today()->toDateString(),
            'tipo_mantto' => 'CORRECTIVO',
            'desc_problema' => 'Rayas leves',
            'severidad' => 'MEDIA',
        ])->assertCreated();

        $this->assertSame(0, \App\Models\Notification::where('tipo', 'MAINTENANCE_CRITICAL')->count());
    }

    public function test_stock_bajo_notifica_a_usuario_con_permiso_articulos_por_rol_id(): void
    {
        $admin = $this->adminUser();
        $conPermiso = $this->userWithPermission('inventario.articulos');
        $sinPermiso = $this->userWithPermission('clientes');

        $article = Article::create([
            'tipo_articulo' => ArticleType::CONSUMIBLE,
            'subtipo' => 'Tóner',
            'nombre' => 'Tóner ' . uniqid(),
            'marca' => 'HP',
            'modelo_sku' => 'SKU-' . uniqid(),
            'stock_actual' => 3,
            'umbral_reposicion' => 2,
            'costo_unitario' => 500,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        // La salida lleva el stock al umbral y dispara la alerta.
        app(InventoryService::class)->registerExit($article, 1, $admin, 'Salida de prueba');

        $this->assertDatabaseHas('notifications', [
            'usuario_id' => $conPermiso->id,
            'tipo' => 'INVENTORY_LOW',
            'referencia_tipo' => 'Article',
            'referencia_id' => $article->id,
        ]);
        $this->assertDatabaseMissing('notifications', [
            'usuario_id' => $sinPermiso->id,
            'tipo' => 'INVENTORY_LOW',
        ]);
    }
}
