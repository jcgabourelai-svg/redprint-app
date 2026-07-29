# Plan: Catálogo de marca/modelo de impresora + compatibilidad a nivel modelo

## Objetivo
Reemplazar el texto libre de `printers.marca`/`printers.modelo` por un **catálogo** (marcas + modelos) y cambiar la compatibilidad de los artículos para que se vincule a **modelos de impresora** (no a impresoras físicas individuales).

## Decisiones confirmadas
1. **Estructura del catálogo:** dos tablas `printer_brands` + `printer_models` (modelo FK a marca).
2. **Alta de marcas/modelos:** creación **inline** en los formularios (combobox *creatable*, solo admin). Sin página CRUD aparte.
3. **Columnas de `printers`:** mantener `marca`/`modelo` **denormalizadas** y sincronizadas desde el modelo; sumar `printer_model_id` (FK).

> Nota: `articles.marca` / `articles.modelo_sku` son la marca/SKU **del propio artículo** (el consumible), no de la impresora. **Se dejan como texto libre**, fuera del alcance de este plan.

---

## Modelo de datos

### Tablas nuevas
- `printer_brands`: `id`, `nombre` (unique, tras normalizar TRIM + lower para evitar duplicados de mayúsculas).
- `printer_models`: `id`, `brand_id` (FK→printer_brands, cascade), `nombre`. Unique `(brand_id, nombre)`.
- `article_printer_model` (pivote): `article_id` (FK→articles, cascade), `printer_model_id` (FK→printer_models, cascade), PK compuesta `(article_id, printer_model_id)`.

### Cambios en tablas existentes
- `printers`: agregar `printer_model_id` BIGINT (nullable durante la migración, FK→printer_models, nullOnDelete). Las columnas `marca`/`modelo` **se conservan**.
- `articles`: la columna `impresoras_compatibles` (JSON) **se elimina** al final de la migración (los datos ya se migraron a la pivote).

### Relaciones Eloquent
- `PrinterBrand` hasMany `PrinterModel`.
- `PrinterModel` belongsTo `PrinterBrand`; belongsToMany `Article` (pivote `article_printer_model`).
- `Article` belongsToMany `PrinterModel` (pivote `article_printer_model`) → relación `modelosCompatibles`.
- `Printer` belongsTo `PrinterModel` (`printer_model_id`); conserva accesores `marca`/`modelo` en columna.

---

## Migración de datos existentes (en la misma migración)
1. Crear `printer_brands` desde `SELECT DISTINCT TRIM(marca) FROM printers` (clave de agrupación normalizada `LOWER(TRIM(marca))`).
2. Crear `printer_models` desde pares únicos `(brand, TRIM(modelo))` (clave `LOWER(brand)||'|'||LOWER(modelo)`).
3. `ALTER printers ADD printer_model_id`; backfill con JOIN por `(LOWER(TRIM(marca)), LOWER(TRIM(modelo)))`.
4. Poblar pivote `article_printer_model`: por cada `articles.impresoras_compatibles` (array de printer_id), resolver el `printer_model_id` de cada impresora y hacer `INSERT IGNORE`/distinct de `(article_id, printer_model_id)`.
5. Tras backfill, marcar `printer_model_id` **NOT NULL** + FK (solo si no quedan nulos; si quedan, dejar nullable y registrar advertencia).
6. `DROP COLUMN articles.impresoras_compatibles`.

> Riesgo controlado: variantes de mayúsculas/espacios se normalizan en el agrupamiento para no crear marcas/modelos duplicados.

---

## Backend (Laravel)

### Modelos nuevos
- `app/Models/PrinterBrand.php`, `app/Models/PrinterModel.php`.

### Modelos existentes
- `Printer.php`: agregar `printer_model_id` a `$fillable`, relación `printerModel(): BelongsTo`. En `PrinterService::create/update`, recibir `printer_model_id` y **sincronizar** `marca`/`modelo` desde el modelo elegido (denormalización).
- `Article.php`: quitar `impresoras_compatibles` de `$fillable` y del cast `'array'`; agregar relación `modelosCompatibles(): BelongsToMany`.

### Requests
- `StorePrinterRequest` / `UpdatePrinterRequest`: reemplazar `marca`/`modelo` (string) por `printer_model_id` (`required|exists:printer_models,id`). Quitar `marca`/`modelo` de reglas.
- `StoreArticleRequest` / `UpdateArticleRequest`: reemplazar `impresoras_compatibles` por `modelos_compatibles` (`nullable|array`, `*.integer|exists:printer_models,id`).

### Resources
- `ArticleResource.php`: exponer `modelos_compatibles` como array (id + marca + modelo) cuando la relación venga cargada; quitar `impresoras_compatibles`.
- `PrinterResource.php`: mantener `marca`/`modelo` (denormalizados); agregar `printer_model_id`.
- Nuevos `PrinterBrandResource.php`, `PrinterModelResource.php` (o respuesta JSON simple).

### Controllers
- `ArticleController`:
  - `store`/`update`: tras crear/actualizar, hacer `$article->modelosCompatibles()->sync($data['modelos_compatibles'] ?? [])`.
  - `compatiblePrinters()` → renombrar a `compatibleModels()`: devolver `$article->modelosCompatibles`.
- `PrinterController`: filtros/sort por `marca`/`modelo` siguen funcionando (columnas denormalizadas). Sin cambios funcionales.
- Nuevos `PrinterBrandController` (index, store) y `PrinterModelController` (index [acepta `?brand_id=`], store). Store admin-gated.

### Service
- `PrinterService::create/update`: resolver `printer_model_id`, setear `marca`/`modelo` desde el modelo (denormalización), dentro de la transacción existente.

### Rutas (`routes/api.php`)
- GET de lectura del catálogo bajo `auth:sanctum` **sin permiso específico** (lo leen tanto la vista de impresoras como la de artículos):
  - `GET /v1/printer-brands` (devuelve marcas; con `?with=modelos` trae sus modelos).
  - `GET /v1/printer-models` (acepta `?brand_id=`).
- POST de creación dentro del grupo `permission:inventario.impresoras` (admin-gate en el controller/request):
  - `POST /v1/printer-brands`
  - `POST /v1/printer-models`
- Renombrar ruta `articles/{article}/compatible-printers` → `articles/{article}/compatible-models`.

### Seeders
- `PrinterSeeder`: primero crear brands/models (reutilizando el array actual de marcas/modelos), luego crear `printers` con `printer_model_id` (y `marca`/`modelo` denormalizados).
- `ArticleSeeder`: reemplazar `impresoras_compatibles` random por `->modelosCompatibles()->sync([...])` con ids de modelos.

### Comando tras cambios de config/rutas
```bash
docker compose exec app php artisan config:cache
```

---

## Frontend (React)

### Types (`frontend/src/types/`)
- `printer-model.ts` (nuevo): `PrinterBrand { id, nombre, modelos?: PrinterModel[] }`, `PrinterModel { id, brand_id, nombre, marca?: string }`.
- `printer.ts`: agregar `printer_model_id?: number`.
- `article.ts`: reemplazar `impresoras_compatibles?: number[]` por `modelos_compatibles?: number[]` (o `PrinterModel[]` cuando venga expandido).

### Hooks
- `usePrinters.ts`: mantener `useAllPrinters` (sigue usándose en mantenimiento y detalle de impresora).
- Nuevo `usePrinterCatalog.ts`: `usePrinterBrands({ withModelos })`, `useCreatePrinterBrand()`, `useCreatePrinterModel()`.
- `useArticles.ts`: `useArticleCompatiblePrinters` → `useArticleCompatibleModels`; ajustar queryKey/endpoint.

### Componente UI nuevo
- `frontend/src/components/ui/CreatableSelect.tsx`: combobox buscable que, si el texto no coincide con una opción existente, ofrece "Crear «X»" (llama a `onCreate`). Reutilizar el patrón de `Select.tsx`/`MultiSelect.tsx`. Solo admins ven la acción de crear (controlado por prop).

### `PrinterForm.tsx`
- Marca: `CreatableSelect` de marcas (crea marca inline si no existe → POST `/printer-brands` → invalidar catálogo → usar nuevo id).
- Modelo: `CreatableSelect` de modelos **filtrado por la marca elegida** (crea modelo inline POST `/printer-models {brand_id, nombre}`).
- Enviar `printer_model_id` (no `marca`/`modelo`). Al editar (`isEdit`), inicializar marca/modelo desde el modelo de la impresora.
- Mantener el resto de campos (num_serie, almacén, fechas, etc.).

### `ArticleList.tsx` (form "Nuevo Artículo")
- Sección "Impresoras compatibles": el `MultiSelect` ahora lista **modelos** (`{marca} {modelo}`), value = model id.
- Enviar `modelos_compatibles: number[]` (model ids). Renombrar estado `compatibles`→`modelos_compatibles`.

### `ArticleDetail.tsx` (pestaña Compatibilidad)
- Lectura: listar **modelos** compatibles (id · marca · modelo).
- Edición: `MultiSelect` de modelos (igual que el form). Guardar via `updateArticle` con `modelos_compatibles`.
- `startEditCompat`: inicializar draft desde `article.modelos_compatibles`.

### Vistas **sin cambios** (verificación)
- `PrinterList.tsx` / `PrinterDetail.tsx`: leen `marca`/`modelo` (denormalizadas) → siguen funcionando. La edición pasa por `PrinterForm` (ya actualizado).
- `CreateMaintenanceOrder.tsx`: selecciona una impresora **física** y muestra `marca modelo` → sigue funcionando.
- `ReportService`, `FinanceReportController`, `ContractResource`, `ReadingResource`: leen `$printer->marca/modelo` → intactos por la denormalización.

### Rebuild del dist (obligatorio para ver cambios en 8080)
```bash
docker compose run --rm --no-deps frontend sh -c "npm run build"
```
Luego hard refresh (Ctrl+F5) en `http://localhost:8080`. Si aparece HTTP 500 en `/` (mount cycle): `docker compose restart nginx`.

---

## Plan de validación
1. **Migración idempotente:** `docker compose exec app php artisan migrate` sin errores; verificar registros en `printer_brands`, `printer_models`, `article_printer_model` y `printers.printer_model_id` no nulo.
2. **Backend tests:** `docker compose exec app php artisan test`.
3. **API (manual):**
   - `GET /v1/printer-brands?with=modelos` → lista correcta.
   - `POST /v1/printer-models` crea modelo; `POST /printers` con `printer_model_id` crea impresora con marca/modelo denormalizados.
   - `POST /articles` con `modelos_compatibles` → pivote poblada; `GET /articles/{id}/compatible-models` retorna modelos.
4. **UI (8080):**
   - Nueva Impresora: marca/modelo como selects creativos; crear marca/modelo nuevos inline.
   - Editar impresora: marca/modelo se precargan correctamente.
   - Nuevo Artículo: compatibilidad lista modelos; guardar y reabrir muestra la selección.
   - Detalle de Artículo: pestaña Compatibilidad muestra/edita modelos.
   - Listados de impresoras/artículos, detalle de impresora y orden de mantenimiento siguen mostrando marca/modelo.
5. **Lint/TS:** `cd frontend && npm run lint` (si corresponde).

---

## Riesgos y casos límite
- **Duplicados por mayúsculas/espacios:** la migración agrupa por `LOWER(TRIM(...))`. Tras migrar, los strings visibles conservan su forma original.
- **`printer_model_id` nulo post-backfill:** si alguna impresora no casara (no debería, los modelos nacen de las impresoras), dejar la columna nullable y revisar manualmente antes del NOT NULL.
- **Renombrar endpoint/field `impresoras_compatibles`→`modelos_compatibles`:** tocar **todos** los puntos (requests, resource, controller, hook, 2 vistas, type) en el mismo cambio para no romper la UI.
- **Denormalización desincronizada:** siempre setear `marca`/`modelo` desde el modelo en `PrinterService`; no permitir editarlos independientemente.

## Fuera de alcance
- Página CRUD dedicada del catálogo (decisión: solo inline).
- Normalizar la marca/SKU del propio artículo (`articles.marca`/`modelo_sku`).
- Sugerencia automática de consumibles compatibles al levantar una orden de mantenimiento (mejora futura, ahora factible gracias a la pivote).

---

## Lista de tareas ordenada

**Backend**
1. Migración: crear `printer_brands`, `printer_models`, `article_printer_model`; agregar `printers.printer_model_id`; backfill + poblar pivote; `DROP articles.impresoras_compatibles`.
2. Modelos `PrinterBrand`, `PrinterModel`; relaciones en `Printer` y `Article`.
3. Requests: `printer_model_id` (printer); `modelos_compatibles` (article).
4. Resources: `PrinterBrandResource`, `PrinterModelResource`; `ArticleResource` (`modelos_compatibles`); `PrinterResource` (`printer_model_id`).
5. Controllers: `PrinterBrandController`, `PrinterModelController`; `ArticleController` (sync + `compatibleModels`); `PrinterService` (denormalización marca/modelo).
6. Rutas: GET catálogo (auth), POST catálogo (`inventario.impresoras`), renombrar `compatible-models`.
7. Seeders: `PrinterSeeder` (brands/models + printer_model_id), `ArticleSeeder` (sync pivote).
8. `php artisan config:cache`.

**Frontend**
9. Types: `printer-model.ts`; ajustar `printer.ts` y `article.ts`.
10. Hook `usePrinterCatalog.ts`; renombrar hook de compatibilidad en `useArticles.ts`.
11. Componente `CreatableSelect.tsx`.
12. `PrinterForm.tsx`: marca/modelo creativos dependientes + `printer_model_id`.
13. `ArticleList.tsx`: MultiSelect de modelos + `modelos_compatibles`.
14. `ArticleDetail.tsx`: compatibilidad por modelos (lectura/edición).
15. `npm run build` en Docker + validación UI en 8080.

**Validación**
16. Migración + `php artisan test` + chequeos API/UI del plan de validación.
