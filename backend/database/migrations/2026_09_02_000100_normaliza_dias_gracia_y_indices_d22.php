<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * D22 (arrastre de consumo), complemento de la redefinicion de
 * `contracts.dias_gracia`:
 *
 * 1. Normaliza TODOS los valores a 7. Pre-D22 la columna era "dias de
 *    gracia para pago" sin uso en logica de negocio, pero el seeder y la
 *    UI antigua dejaron valores heterogeneos (3-15) que ahora definirian
 *    ventanas de cierre inconsistentes entre contratos.
 * 2. Indices para las rutas de query de D22: lecturas del hueco por
 *    contrato y rango de fecha, y detalles de factura por contrato
 *    (derivacion de la ultima lectura facturada). Forward-only en datos:
 *    el down() solo revierte los indices.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('contracts')
            ->where(function ($query) {
                $query->whereNull('dias_gracia')
                    ->orWhere('dias_gracia', '!=', 7);
            })
            ->update(['dias_gracia' => 7]);

        // Idempotente: tolera re-ejecucion (p. ej. verificacion de la
        // migracion en tests sobre un esquema ya migrado).
        foreach ([
            ['readings', 'readings_contrato_fecha_idx', fn () => Schema::table('readings', function (Blueprint $table) {
                $table->index(['contrato_id', 'fecha'], 'readings_contrato_fecha_idx');
            })],
            ['invoice_details', 'invoice_details_contrato_id_idx', fn () => Schema::table('invoice_details', function (Blueprint $table) {
                $table->index('contrato_id', 'invoice_details_contrato_id_idx');
            })],
        ] as [$tabla, $indice, $crear]) {
            $existe = DB::table('pg_indexes')
                ->where('schemaname', 'public')
                ->where('indexname', $indice)
                ->exists();
            if (! $existe) {
                $crear();
            }
        }
    }

    public function down(): void
    {
        Schema::table('readings', function (Blueprint $table) {
            $table->dropIndex('readings_contrato_fecha_idx');
        });

        Schema::table('invoice_details', function (Blueprint $table) {
            $table->dropIndex('invoice_details_contrato_id_idx');
        });
    }
};
