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
        Schema::create('xml_comprobantes', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->string('version');
            $table->string('serie')->nullable();
            $table->string('folio')->nullable();
            $table->string('serie_folio')->nullable()->index();
            $table->string('tipo_comprobante')->index();
            $table->dateTime('fecha_emision');
            $table->string('moneda')->nullable();
            $table->decimal('tipo_cambio', 12, 4)->nullable();
            $table->string('forma_pago')->nullable();
            $table->string('metodo_pago')->nullable();
            $table->string('lugar_expedicion')->nullable();
            $table->string('condiciones_de_pago')->nullable();
            $table->string('confirmacion')->nullable();

            // Emisor (tu empresa en ingresos)
            $table->string('rfc_emisor');
            $table->string('nombre_emisor')->nullable();
            $table->string('regimen_fiscal_emisor')->nullable();

            // Receptor (tu cliente en ingresos)
            $table->string('rfc_receptor');
            $table->string('nombre_receptor')->nullable();
            $table->string('uso_cfdi')->nullable();
            $table->string('regimen_fiscal_receptor')->nullable();
            $table->string('domicilio_fiscal_receptor')->nullable();

            // Totales
            $table->decimal('subtotal', 12, 2);
            $table->decimal('descuento', 12, 2)->nullable();
            $table->decimal('total', 12, 2);
            $table->decimal('total_impuestos_trasladados', 12, 2)->nullable();
            $table->decimal('total_impuestos_retenidos', 12, 2)->nullable();
            $table->decimal('iva_trasladado', 12, 2)->nullable();
            $table->decimal('iva_retenido', 12, 2)->nullable();

            // Meta
            $table->longText('contenido_xml')->nullable();
            $table->string('estado_sat')->nullable();
            $table->text('notas')->nullable();

            $table->foreignId('receptor_id')
                ->nullable()
                ->constrained('clients')
                ->nullOnDelete();
            $table->foreignId('creado_por')->constrained('users');
            $table->timestamp('fecha_creacion')->nullable();
            $table->timestamps();

            // rfc_receptor queda cubierto por el prefijo izquierdo del indice
            // compuesto de abajo; no se crea un indice redundante.
            $table->index('fecha_emision');
            $table->index(['rfc_receptor', 'tipo_comprobante', 'serie_folio', 'receptor_id']);
        });

        $this->seedPermission();
    }

    /**
     * Siembra el permiso `finanzas.cfdi` de forma idempotente y lo asocia a los
     * roles base (igual que hace la migracion 000032). Se hace aqui (no en un
     * seeder) para que `docker compose up -d` lo deje operativo sin seed manual.
     */
    private function seedPermission(): void
    {
        $permiso = Permission::firstOrCreate(
            ['clave' => 'finanzas.cfdi'],
            [
                'modulo' => 'finanzas',
                'etiqueta' => 'Comprobantes CFDI (XML)',
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
        Schema::dropIfExists('xml_comprobantes');
    }
};
