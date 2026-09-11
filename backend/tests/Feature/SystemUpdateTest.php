<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\UpdateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SystemUpdateTest extends TestCase
{
    use RefreshDatabase;

    private string $canal;

    protected function setUp(): void
    {
        parent::setUp();
        // Canal aislado: los tests corren contra storage/app/update-testing
        // para no tocar (ni borrar banderas de) el canal real de dev.
        $this->canal = storage_path('app/update-testing');
        $this->limpiarCanal();
        $this->app->instance(UpdateService::class, new UpdateService($this->canal));
    }

    protected function tearDown(): void
    {
        $this->limpiarCanal();
        parent::tearDown();
    }

    /**
     * Directorio exclusivo del canal de pruebas (update-testing): borramos los
     * archivos del protocolo y el propio directorio. Jamas toca app/update.
     */
    private function limpiarCanal(): void
    {
        if (is_file($this->canal)) {
            @unlink($this->canal);

            return;
        }
        if (! is_dir($this->canal)) {
            return;
        }
        foreach (['request', 'request.tmp', 'status.json', 'version.json', 'update.log'] as $f) {
            @unlink($this->canal.'/'.$f);
        }
        @rmdir($this->canal);
    }

    private function prepararCanal(array $archivos): void
    {
        if (! is_dir($this->canal)) {
            mkdir($this->canal, 0775, true);
        }
        foreach ($archivos as $nombre => $contenido) {
            file_put_contents($this->canal.'/'.$nombre, $contenido);
        }
    }

    private function userWithPermissions(array $claves): User
    {
        $role = Role::create([
            'nombre' => 'Rol Test '.uniqid(),
            'slug' => 'rol-test-'.uniqid(),
            'es_sistema' => false,
        ]);
        $role->permissions()->sync(Permission::whereIn('clave', $claves)->pluck('id'));

        return User::create([
            'nombre' => 'Operador Test',
            'correo' => 'operador-'.uniqid().'@test.com',
            'contrasena_hash' => 'password',
            'telefono' => '555-0199',
            'rol_id' => $role->id,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);
    }

    private function userSinPermiso(): User
    {
        return $this->userWithPermissions(['sistema.notificaciones']);
    }

    public function test_usuario_sin_permiso_recibe_403_en_los_tres_endpoints(): void
    {
        $user = $this->userSinPermiso();
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/system/update')->assertStatus(403);
        $this->getJson('/api/v1/system/update/status')->assertStatus(403);
        $this->getJson('/api/v1/system/update/version')->assertStatus(403);
    }

    public function test_post_con_permiso_deja_bandera_json_y_devuelve_202(): void
    {
        $user = $this->userWithPermissions(['sistema.actualizar']);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/system/update')
            ->assertStatus(202)
            ->assertJsonPath('estado', 'en_cola');

        $this->assertFileExists($this->canal.'/request');

        $bandera = json_decode(file_get_contents($this->canal.'/request'), true);
        $this->assertIsArray($bandera);
        $this->assertEquals($user->id, $bandera['pedida_por_id']);
        $this->assertEquals($user->correo, $bandera['pedida_por_email']);
        $this->assertArrayHasKey('ts', $bandera);
    }

    public function test_doble_post_con_bandera_presente_devuelve_409(): void
    {
        $user = $this->userWithPermissions(['sistema.actualizar']);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/system/update')->assertStatus(202);
        $this->postJson('/api/v1/system/update')->assertStatus(409);
    }

    public function test_post_durante_actualizacion_corriendo_devuelve_409(): void
    {
        $user = $this->userWithPermissions(['sistema.actualizar']);
        Sanctum::actingAs($user);

        $this->prepararCanal(['status.json' => '{"estado":"corriendo"}']);

        $this->postJson('/api/v1/system/update')->assertStatus(409);
        $this->assertFileDoesNotExist($this->canal.'/request');
    }

    public function test_post_con_canal_no_escribible_falla_ruidoso(): void
    {
        $user = $this->userWithPermissions(['sistema.actualizar']);
        Sanctum::actingAs($user);

        // Un archivo regular ocupa la ruta del canal: mkdir no puede crear el
        // directorio (falla para cualquier usuario) y la API no debe responder
        // 202 fantasma sin bandera.
        file_put_contents($this->canal, 'ocupa-la-ruta');

        $this->postJson('/api/v1/system/update')->assertStatus(500);
    }

    public function test_get_status_sin_archivos_devuelve_inactivo(): void
    {
        $user = $this->userWithPermissions(['sistema.actualizar']);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/system/update/status')
            ->assertOk()
            ->assertJsonPath('estado', 'inactivo')
            ->assertJsonPath('log', fn ($log) => $log === null);
    }

    public function test_get_status_reporta_en_cola_con_bandera_y_run_anterior_listo(): void
    {
        $user = $this->userWithPermissions(['sistema.actualizar']);
        Sanctum::actingAs($user);

        // Contrato: entre el POST 202 y el reclamo del cron, status.json aun
        // muestra el run anterior ('listo'); la API debe reportar en_cola.
        $this->prepararCanal([
            'status.json' => '{"estado":"listo","rama":"main","sha":"abc1234"}',
            'request' => '{"pedida_por_id":1}',
        ]);

        $this->getJson('/api/v1/system/update/status')
            ->assertOk()
            ->assertJsonPath('estado', 'en_cola');
    }

    public function test_get_status_corriendo_tiene_prioridad_sobre_la_bandera(): void
    {
        $user = $this->userWithPermissions(['sistema.actualizar']);
        Sanctum::actingAs($user);

        $this->prepararCanal([
            'status.json' => '{"estado":"corriendo"}',
            'request' => 're-encolado',
        ]);

        $this->getJson('/api/v1/system/update/status')
            ->assertOk()
            ->assertJsonPath('estado', 'corriendo');
    }

    public function test_get_status_con_status_json_devuelve_los_campos(): void
    {
        $user = $this->userWithPermissions(['sistema.actualizar']);
        Sanctum::actingAs($user);

        $this->prepararCanal([
            'status.json' => json_encode([
                'estado' => 'corriendo',
                'rama' => 'main',
                'sha' => 'abc1234',
                'inicio' => '2026-09-11T18:00:00Z',
                'fin' => null,
                'detalle' => 'actualizacion en curso',
            ]),
            'update.log' => "[1] Paso 1/7: backup...\n",
        ]);

        $this->getJson('/api/v1/system/update/status')
            ->assertOk()
            ->assertJsonPath('estado', 'corriendo')
            ->assertJsonPath('rama', 'main')
            ->assertJsonPath('sha', 'abc1234')
            ->assertJsonPath('inicio', '2026-09-11T18:00:00Z')
            ->assertJsonPath('fin', null)
            ->assertJsonPath('detalle', 'actualizacion en curso')
            ->assertJsonPath('log', "[1] Paso 1/7: backup...\n");
    }

    public function test_get_version_sin_archivo_devuelve_null(): void
    {
        $user = $this->userWithPermissions(['sistema.actualizar']);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/system/update/version')
            ->assertOk()
            ->assertJsonPath('version', null);
    }

    public function test_post_registra_entrada_en_audit_log(): void
    {
        $user = $this->userWithPermissions(['sistema.actualizar']);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/system/update')->assertStatus(202);

        $this->assertDatabaseHas('audit_logs', [
            'usuario_id' => $user->id,
            'accion' => 'sistema.actualizar.solicitada',
            'entidad_tipo' => 'system',
            'entidad_id' => 0,
        ]);
    }

    public function test_migracion_siembra_permiso_y_lo_asocia_solo_al_administrador(): void
    {
        // Ruta fresh-install completa: RefreshDatabase corre TODAS las
        // migraciones, incluida la 000032 que sincroniza todo el catalogo a
        // administrador y operador. Esta migracion debe dejar el permiso
        // unicamente en administrador (mismo resultado que en el VPS ya
        // migrado), asi que se aserta el estado final sin trucos de rollback.
        $permiso = Permission::where('clave', 'sistema.actualizar')->first();
        $this->assertNotNull($permiso);
        $this->assertEquals('sistema', $permiso->modulo);
        $this->assertEquals('Actualizar sistema', $permiso->etiqueta);

        $administrador = Role::where('slug', 'administrador')->first();
        $operador = Role::where('slug', 'operador')->first();

        $this->assertTrue($administrador->permissions()->whereKey($permiso->id)->exists());
        $this->assertFalse($operador->permissions()->whereKey($permiso->id)->exists());

        // down()/up(): reversible y vuelve a converger al mismo estado.
        $this->artisan('migrate:rollback', ['--step' => 1])->assertSuccessful();
        $this->assertFalse(Permission::where('clave', 'sistema.actualizar')->exists());

        $this->artisan('migrate')->assertSuccessful();

        $permiso = Permission::where('clave', 'sistema.actualizar')->first();
        $this->assertNotNull($permiso);
        $this->assertTrue($administrador->fresh()->permissions()->whereKey($permiso->id)->exists());
        $this->assertFalse($operador->fresh()->permissions()->whereKey($permiso->id)->exists());
    }
}
