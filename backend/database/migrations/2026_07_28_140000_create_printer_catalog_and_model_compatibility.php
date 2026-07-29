<?php

use App\Models\PrinterBrand;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Crear catálogo de marcas
        Schema::create('printer_brands', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('slug');
            $table->timestamps();

            $table->unique('slug');
        });

        // 2. Crear catálogo de modelos
        Schema::create('printer_models', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained('printer_brands')->cascadeOnDelete();
            $table->string('nombre');
            $table->timestamps();

            $table->unique(['brand_id', 'nombre']);
        });

        // 3. Agregar printer_model_id a printers (nullable durante backfill)
        Schema::table('printers', function (Blueprint $table) {
            $table->foreignId('printer_model_id')
                ->nullable()
                ->after('modelo')
                ->constrained('printer_models')
                ->nullOnDelete();
        });

        // 4. Poblar brands + models desde printers existentes
        $this->populateCatalog();

        // 5. Backfill printer_model_id en printers
        $this->backfillPrinterModelId();

        // 6. Pivote article_printer_model
        Schema::create('article_printer_model', function (Blueprint $table) {
            $table->foreignId('article_id')->constrained('articles')->cascadeOnDelete();
            $table->foreignId('printer_model_id')->constrained('printer_models')->cascadeOnDelete();
            $table->primary(['article_id', 'printer_model_id']);
        });

        // 7. Migrar impresoras_compatibles -> pivote. Devuelve cuántas referencias
        //    no pudieron resolverse a un modelo (para advertir antes de dropear).
        $unresolved = $this->migrateArticleCompatibility();

        // 8. Marcar printer_model_id NOT NULL si no quedan nulos
        $nullCount = DB::table('printers')->whereNull('printer_model_id')->count();
        if ($nullCount === 0) {
            DB::statement('ALTER TABLE printers ALTER COLUMN printer_model_id SET NOT NULL');
        } else {
            // No fallar (la columna queda nullable), pero dejar clara la advertencia.
            Log::warning(
                "[migration printer_catalog] {$nullCount} impresora(s) quedaron sin printer_model_id. "
                . 'La columna se dejó nullable; revísalas antes de imponer NOT NULL.'
            );
        }

        if ($unresolved > 0) {
            Log::warning(
                "[migration printer_catalog] {$unresolved} referencia(s) de articles.impresoras_compatibles "
                . 'no se pudieron resolver a modelos de impresora (impresora inexistente o sin modelo). '
                . 'Esa compatibilidad NO se migró y se perderá al eliminar la columna.'
            );
        }

        // 9. Eliminar columna impresoras_compatibles de articles
        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn('impresoras_compatibles');
        });
    }

    /**
     * Slug normalizado: delega en el modelo para una sola fuente de verdad
     * (la usan controller, model, seeder y esta migración).
     */
    private function slugFrom(string $nombre): string
    {
        return PrinterBrand::slugFrom($nombre);
    }

    private function populateCatalog(): void
    {
        if (!Schema::hasTable('printers') || !DB::table('printers')->exists()) {
            return;
        }

        $now = now();

        // Brands: un insert por slug único ya garantizado por el DISTINCT.
        $brandRows = DB::table('printers')
            ->selectRaw("DISTINCT TRIM(marca) AS marca_raw")
            ->whereNotNull('marca')
            ->where('marca', '!=', '')
            ->get();

        foreach ($brandRows as $row) {
            $slug = $this->slugFrom($row->marca_raw);

            $exists = DB::table('printer_brands')->where('slug', $slug)->exists();
            if (!$exists) {
                DB::table('printer_brands')->insert([
                    'nombre' => $row->marca_raw,
                    'slug' => $slug,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        // Preload brands slug => id (un mapa en memoria para evitar N+1).
        $brandIdBySlug = DB::table('printer_brands')->pluck('id', 'slug');

        // Modelos: pares únicos (marca, modelo).
        $modelRows = DB::table('printers')
            ->selectRaw("DISTINCT TRIM(marca) AS marca_raw, TRIM(modelo) AS modelo_raw")
            ->whereNotNull('marca')->where('marca', '!=', '')
            ->whereNotNull('modelo')->where('modelo', '!=', '')
            ->get();

        foreach ($modelRows as $row) {
            $brandSlug = $this->slugFrom($row->marca_raw);
            $brandId = $brandIdBySlug[$brandSlug] ?? null;
            if (!$brandId) {
                continue;
            }

            DB::table('printer_models')->insertOrIgnore([
                'brand_id' => $brandId,
                'nombre' => $row->modelo_raw,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function backfillPrinterModelId(): void
    {
        if (!DB::table('printers')->exists()) {
            return;
        }

        // Mapa brand_id por slug y modelo por clave "brand_id|nombre" (un solo pase a DB).
        $brandIdBySlug = DB::table('printer_brands')->pluck('id', 'slug');
        $models = DB::table('printer_models')->get(['id', 'brand_id', 'nombre']);
        $modelIdByKey = [];
        foreach ($models as $m) {
            $modelIdByKey[$m->brand_id . '|' . $m->nombre] = $m->id;
        }

        // Backfill en lotes para no cargar toda la tabla en memoria.
        DB::table('printers')
            ->whereNull('printer_model_id')
            ->select(['id', 'marca', 'modelo'])
            ->chunkById(500, function ($printers) use ($brandIdBySlug, $modelIdByKey) {
                foreach ($printers as $printer) {
                    $brandSlug = $this->slugFrom($printer->marca);
                    $brandId = $brandIdBySlug[$brandSlug] ?? null;
                    if (!$brandId) {
                        continue;
                    }

                    $key = $brandId . '|' . trim($printer->modelo);
                    $modelId = $modelIdByKey[$key] ?? null;

                    if ($modelId) {
                        DB::table('printers')
                            ->where('id', $printer->id)
                            ->update(['printer_model_id' => $modelId]);
                    }
                }
            });
    }

    /**
     * Migra articles.impresoras_compatibles (array de printer_id) -> pivote.
     * Devuelve el número de referencias que no pudieron resolverse a un modelo.
     */
    private function migrateArticleCompatibility(): int
    {
        if (!Schema::hasColumn('articles', 'impresoras_compatibles')) {
            return 0;
        }

        $unresolved = 0;

        // Mapa printer_id => printer_model_id (una sola consulta).
        $printerToModel = DB::table('printers')
            ->whereNotNull('printer_model_id')
            ->pluck('printer_model_id', 'id');

        DB::table('articles')
            ->whereNotNull('impresoras_compatibles')
            ->select(['id', 'impresoras_compatibles'])
            ->chunkById(500, function ($articles) use ($printerToModel, &$unresolved) {
                foreach ($articles as $article) {
                    $raw = $article->impresoras_compatibles;
                    if ($raw === null) {
                        continue;
                    }

                    $printerIds = json_decode($raw, true);
                    if (!is_array($printerIds) || empty($printerIds)) {
                        continue;
                    }

                    $modelIds = [];
                    foreach ($printerIds as $printerId) {
                        $modelId = $printerToModel[$printerId] ?? null;
                        if ($modelId) {
                            $modelIds[(int) $modelId] = true;
                        } else {
                            $unresolved++;
                        }
                    }

                    foreach (array_keys($modelIds) as $modelId) {
                        DB::table('article_printer_model')->insertOrIgnore([
                            'article_id' => $article->id,
                            'printer_model_id' => $modelId,
                        ]);
                    }
                }
            });

        return $unresolved;
    }

    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->json('impresoras_compatibles')->nullable()->after('proveedor_id');
        });

        Schema::table('printers', function (Blueprint $table) {
            $table->dropForeign(['printer_model_id']);
            $table->dropColumn('printer_model_id');
        });

        Schema::dropIfExists('article_printer_model');
        Schema::dropIfExists('printer_models');
        Schema::dropIfExists('printer_brands');
    }
};
