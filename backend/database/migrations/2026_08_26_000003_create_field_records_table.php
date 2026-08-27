<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('field_records', function (Blueprint $table) {
            $table->id();
            $table->string('tipo', 30);
            $table->string('estado', 20)->default('PENDIENTE');

            // Datos crudos reportados por el operador (texto libre)
            $table->string('nombre_cliente_reportado');
            $table->string('direccion_reportada')->nullable();
            $table->string('marca_reportada')->nullable();
            $table->string('modelo_reportada')->nullable();
            $table->string('num_serie_reportado')->nullable();
            $table->integer('valor_contador')->nullable();
            $table->json('articulos_entregados')->nullable();
            $table->text('notas')->nullable();

            // Evidencia inmutable del hecho físico
            $table->text('foto_evidencia')->nullable();
            $table->decimal('ubicacion_lat', 10, 7)->nullable();
            $table->decimal('ubicacion_lng', 10, 7)->nullable();
            $table->timestamp('capturado_en');
            $table->string('client_uuid')->nullable()->unique();

            $table->foreignId('socio_id')->constrained('users');
            $table->foreignId('creado_por')->constrained('users');

            // Vinculación (todo null hasta regularizar)
            $table->foreignId('cliente_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->foreignId('contrato_id')->nullable()->constrained('contracts')->nullOnDelete();
            $table->foreignId('impresora_id')->nullable()->constrained('printers')->nullOnDelete();
            $table->foreignId('visita_id')->nullable()->constrained('visits')->nullOnDelete();
            $table->foreignId('lectura_id')->nullable()->constrained('readings')->nullOnDelete();
            $table->foreignId('vinculado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('vinculado_en')->nullable();
            $table->text('motivo_descarte')->nullable();

            $table->timestamps();

            $table->index('estado');
            $table->index('socio_id');
        });

        $this->seedPermission();
    }

    /**
     * Siembra el permiso `operaciones.registros-campo` de forma idempotente y
     * lo asocia a los roles base (patron de la migracion 000036). RolePermission
     * Seeder sincroniza TODOS los permisos al rol operador, asi que el permiso
     * queda otorgado sin cambios adicionales; operador-inventario NO lo recibe.
     */
    private function seedPermission(): void
    {
        $permiso = Permission::firstOrCreate(
            ['clave' => 'operaciones.registros-campo'],
            [
                'modulo' => 'operaciones',
                'etiqueta' => 'Registros de campo',
            ]
        );

        foreach (['administrador', 'operador'] as $slug) {
            $rol = Role::firstWhere('slug', $slug);
            if ($rol && ! $rol->permissions()->where('permission_id', $permiso->id)->exists()) {
                $rol->permissions()->attach($permiso->id);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('field_records');
    }
};
