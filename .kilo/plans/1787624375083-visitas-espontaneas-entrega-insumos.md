# Plan: Visitas espontáneas + Entrega de insumos (app móvil)

## Contexto y hallazgos clave

- Los **toners ya existen** como `Article` con `tipo_articulo=CONSUMIBLE`, `subtipo=TONER|PAPEL|ETIQUETAS`, stock y `InventoryService` (salidas con lock, auditoría y alertas). **NO se crea un modelo Toner nuevo.**
- `POST /api/v1/visits` ya existe (`VisitController::store`, protegido por `permission:operaciones.calendario`). El móvil solo necesita UI + datos para pickers.
- El frontend web NO envía `contrato_id` al crear visitas, pero los flujos móviles (lectura/instalación/retiro) **requieren contrato** (las impresoras vienen de `contract.activePrinters`). El flujo móvil debe pedir contrato.
- Precedentes a seguir: endpoint ligero `GET /visits/socios` (pickers bajo `operaciones.calendario`); `articles_used` (snapshot `costo_unitario`+`subtotal`); `ContractController::assignPrinter` (acción sub-resource sobre contrato).
- `BusinessRuleException` se renderiza como **422 con `message`** (bootstrap/app.php:33) → el móvil ya lo muestra vía `apiErrorMessage`.

## Decisiones confirmadas con el usuario

1. **Permiso creación de visitas**: reusar `operaciones.calendario` (sin permisos nuevos, sin cambios en config/permisos.php).
2. **Entrega de insumos**: nuevo tipo de visita `ENTREGA_INSUMOS` ligada a visita (programada o espontánea). Picker muestra todos los CONSUMIBLEs activos con stock (toner, papel, etiquetas).
3. **Cobro al cliente**: FUERA de alcance v1. Solo snapshot de `costo_unitario` para facturación futura.
4. **Offline**: creación de visita y entrega son **online-only** (consistente con instalación/retiro). La cola offline sigue siendo solo de lecturas.
5. Trazabilidad: columna `origen` en `visits` (`'CAMPO'` para las creadas desde móvil) para poder reportar visitas espontáneas.

---

# FASE 1 — Visita espontánea desde el móvil

## Backend

### 1.1 Migración `add_origen_to_visits_table`
- `visits.origen` string **nullable**, default null (scheduler/web) — móvil manda `'CAMPO'`.
- Después: `Visit::$fillable` += `origen`; `VisitResource` expone `origen`.

### 1.2 Endpoint picker: `GET /api/v1/visits/clientes`
En `routes/api.php` dentro del grupo `permission:operaciones.calendario` (junto a `visits/socios`, registrar ANTES de `Route::apiResource('visits', ...)` para que no colisione con `{visit}`).

Método `VisitController::clientes()`:
- `Client::whereHas('contracts', estado=ACTIVO)` → `with(['contracts' => solo ACTIVO])` → `orderBy('razon_social')` → `get(['id','razon_social'])`.
- Respuesta: `[{"id":1,"razon_social":"ACME SA","contratos":[{"id":5,"codigo_negocio":"CT-0005"}]}]` (mismo estilo plano que `socios()`).
- Solo clientes con contrato ACTIVO: si el cliente no tiene contrato activo, no hay flujo móvil posible (los contratos se crean desde la web; limitación aceptada).

### 1.3 `StoreVisitRequest`
- `'origen' => 'nullable|string|in:CAMPO'` (el resto ya soporta `contrato_id` nullable; no tocar `fecha_programada` — el móvil manda hoy).

## Móvil (`mobile/src/`)

### 1.4 `types/api.ts`
- `Visit` += `origen: string | null`, `contratos` no aplica (va en tipo picker local): `ClientOption { id: number; razon_social: string; contratos: { id: number; codigo_negocio: string }[] }`.

### 1.5 Página `pages/NewVisitPage.tsx` — ruta `/visita/nueva`
- Permiso: `hasPermission('operaciones.calendario')`; online-only con banner 📴 (patrón `InstallationPage`).
- Datos: `fetchAll<ClientOption>('/visits/clientes')`.
- Formulario:
  - **Cliente**: buscador texto + lista filtrable client-side (chequeo `cancelled` como en InstallationPage).
  - **Contrato**: chips/select de `cliente.contratos`. **Requerido** para LECTURA/INSTALACION/RETIRO (y ENTREGA_INSUMOS en Fase 2); opcional para MANTENIMIENTO.
  - **tipo_visita**: LECTURA / INSTALACION / RETIRO / MANTENIMIENTO (Fase 2 agrega ENTREGA_INSUMOS).
  - **fecha_programada**: `<input type="date">` default `todayISO()`.
  - **notas** textarea opcional.
  - `socio_id` = usuario actual (`useAuth`).
- Submit: `POST /visits` con `{ cliente_id, contrato_id, tipo_visita, fecha_programada, socio_id, notas, origen: 'CAMPO' }` → `navigate('/visita/' + id)` (el operador actúa de inmediato con los flujos existentes).
- Registrar ruta en `App.tsx` DENTRO del `Layout` (route `visita/nueva` **antes** de `visita/:id` para evitar match de "nueva" como id — React Router v6: usar segmento estático primero).

### 1.6 Entrada al flujo
- `TodayPage`: botón «+ Visita» junto a los chips de filtro (visible con `canOperaciones`) → `/visita/nueva`.
- `VisitCard`: opcional badge «Campo» cuando `v.origen === 'CAMPO'`.

---

# FASE 2 — Entrega de insumos (toner/consumibles)

## Backend

### 2.1 Enum y validación
- `App\Enums\VisitType`: `case ENTREGA_INSUMOS = 'ENTREGA_INSUMOS';`
- `StoreVisitRequest`: agregar `'ENTREGA_INSUMOS'` al `in:` de `tipo_visita`.

### 2.2 Migración `create_article_deliveries_table`
Sigue el patrón de `articles_used` (snapshot de costos); la **visita es el "header"**, cada fila es un artículo entregado:
```
id
articulo_id     FK articles cascadeOnDelete   (index)
visita_id       FK visits cascadeOnDelete     (index)
contrato_id     FK contracts nullOnDelete, nullable
cliente_id      FK clients cascadeOnDelete
cantidad        integer > 0
costo_unitario  decimal 12,2   (snapshot al momento)
subtotal        decimal 12,2   (cantidad * costo_unitario)
socio_id        FK users
notas           string nullable
fecha_creacion  timestamp nullable
timestamps
```

### 2.3 Modelo `ArticleDelivery` + relaciones
- Fillable/casts según migración; relaciones `article`, `visit`, `contract`, `socio`.
- `Visit::deliveries(): HasMany`.
- `ArticleResource`-style: crear `ArticleDeliveryResource` (`id, articulo_id, visita_id, cantidad, costo_unitario, subtotal, article: {nombre, marca, modelo_sku} whenLoaded, fecha_creacion`).

### 2.4 Servicio `DeliveryService` (nuevo, patrón `MaintenanceService`)
```php
deliver(Visit $visit, int $articleId, int $cantidad, User $socio): ArticleDelivery
```
- Validar: `$visit->tipo_visita === ENTREGA_INSUMOS`, `estado` in `[PENDIENTE, REPROGRAMADA]`, artículo `activo=true`, `cantidad >= 1`.
- `DB::transaction`: crear `ArticleDelivery` (snapshot costo) sobre artículo con lock → `InventoryService::registerExit($article, $cantidad, $socio, 'ARTICLE_DELIVERY', $delivery->id, "Entrega en visita #{$visit->id}")`. (registerExit ya valida stock y lanza `BusinessRuleException` → 422.)

### 2.5 Rutas y controlador (en `VisitController`, junto a complete/reschedule)
Dentro del grupo `permission:inventario.articulos` (es una salida de stock; consistente con que instalación pida `contratos`+`inventario.impresoras`):
```php
Route::post('visits/{visit}/deliver-article', [VisitController::class, 'deliverArticle']);
Route::get('visits/{visit}/deliveries', [VisitController::class, 'deliveries']);
```
⚠️ Deben ir en su PROPIO grupo de middleware (no dentro de `operaciones.calendario`) en `routes/api.php`.
- `deliverArticle`: valida `{articulo_id: required|exists, cantidad: required|integer|min:1}` → `DeliveryService::deliver` → 201 con `ArticleDeliveryResource`.
- `deliveries`: lista paginada/chata de entregas de la visita.
- `VisitController::show`: eager load `deliveries.article` → `VisitResource` agrega `'entregas' => ArticleDeliveryResource::collection($this->whenLoaded('deliveries.article'))`.

### 2.6 No auto-completar
La visita `ENTREGA_INSUMOS` se cierra con el botón «Completar visita» existente (no hay regla de completitud como en lecturas).

## Móvil

### 2.7 `types/api.ts`
- `TipoVisita` += `'ENTREGA_INSUMOS'`.
- `Article { id, nombre, marca, modelo_sku, subtipo, stock_actual, costo_unitario, tipo_articulo }` (el index de `/articles` ya devuelve el modelo plano con `stock_actual`).
- `ArticleDelivery` + `Visit.entregas?: ArticleDelivery[]`.

### 2.8 `components/ui.tsx`
- Agregar `ENTREGA_INSUMOS` a `tipoVisitaIcon` (📦) y `tipoVisitaTone`.

### 2.9 `pages/DeliveryPage.tsx` — ruta `/visita/:id/entrega`
- Permiso `inventario.articulos` (banner si falta) + online-only (patrón InstallationPage).
- Carga visita (debe ser `ENTREGA_INSUMOS` y estado editable; banner si no) + `fetchAll<Article>('/articles', { tipo: 'CONSUMIBLE', activo: 1 })`.
- Cards de artículo: nombre, marca/SKU, subtipo, badge stock (`stock_actual`); al seleccionar → input cantidad (1..stock_actual validado client-side).
- Submit → `POST /visits/{id}/deliver-article` → toast éxito con stock restante → recargar entregas de la visita (permite entregar otro artículo).
- Errores 422 (stock insuficiente por concurrencia) se muestran con `apiErrorMessage`.
- Sección «Ya entregado en esta visita» con la lista (`visit.entregas`).

### 2.10 `pages/VisitDetailPage.tsx`
- Bloque para `tipo_visita === 'ENTREGA_INSUMOS'`: botón «📦 Entregar insumos» → `/visita/:id/entrega` (deshabilitado + banner si falta `inventario.articulos` o visita no editable).
- Listado de entregas de la visita (nombre, cantidad, subtotal).

### 2.11 `pages/NewVisitPage.tsx` (Fase 1)
- Agregar `ENTREGA_INSUMOS` al picker de tipo (requiere contrato).

## Web frontend (mínimo)

### 2.12 `frontend/src/pages/operations/calendar/CalendarPage.tsx`
- Agregar `ENTREGA_INSUMOS` («Entrega de insumos») a las opciones de `tipo_visita` del modal «Nueva visita» (L30–35 y options del select) para que la oficina pueda programarlas.
- Enviar `contrato_id` NO es necesario (el flujo web actual no lo manda; si queda null, la oficina la reprograma o el detalle móvil mostrará el banner conocido). Opcional: añadir picker de contrato — dejar fuera de alcance.

---

# Migraciones / rollout (Docker)

```bash
docker compose exec app php artisan migrate
docker compose exec app php artisan config:cache
docker compose exec app php artisan test
docker compose run --rm --no-deps mobile sh -c "npm run lint && npm run build"   # dist móvil
docker compose run --rm --no-deps frontend sh -c "npm run build"                  # solo si se tocó frontend/
```
Al final: recargar `http://localhost:8080/m/` (y `/`) con Ctrl+F5.

# Tests a agregar (backend, `backend/tests/Feature/`)

Convención: `RefreshDatabase` + `Sanctum::actingAs` + rol es_sistema (ver `ManualStockMovementTest`).

1. **SpontaneousVisitTest**
   - `GET /visits/clientes` devuelve solo clientes con contrato ACTIVO y sus contratos; 403 sin `operaciones.calendario`.
   - `POST /visits` con `contrato_id` + `origen:'CAMPO'` crea visita PENDIENTE con `fecha_programada` dada; `origen` fuera de `in:CAMPO` → 422.
2. **ArticleDeliveryTest**
   - Happy path: stock decrementa, `inventory_movements` crea SALIDA con `referencia_tipo='ARTICLE_DELIVERY'` y `referencia_id`, fila con snapshot `costo_unitario/subtotal`.
   - Stock insuficiente → 422 con message.
   - Visita con otro `tipo_visita` (ej. LECTURA) → 422; visita COMPLETADA → 422.
   - `GET /visits/{v}/deliveries` lista entregas; `GET /visits/{v}` incluye `entregas`.
   - 403 a usuario sin `inventario.articulos` (ej. rol solo `operaciones.calendario`).

# Riesgos y casos límite

- **Cliente sin contrato activo**: no aparece en el picker → no se puede crear visita móvil (crear contratos es tarea de oficina; documentado como limitación).
- **Concurrencia de stock**: `registerExit` usa `lockForUpdate` + transacción → seguro; el móvil muestra el 422.
- **Doble entrega del mismo artículo en la misma visita**: permitida a propósito (entregas parciales); no hay unicidad.
- **Duplicar visita espontánea**: sin guard de unicidad (igual que web); mitigación UX: la lista «Hoy» ya muestra la visita recién creada.
- `visits/clientes` debe registrarse antes del resource route para no ser capturada por `{visit}`.

# Fuera de alcance (explícito)

- Cobro/facturación de insumos entregados (queda el snapshot de costo para futuro).
- Entregas offline (cola IndexedDB sigue solo para lecturas).
- Crear clientes/contratos desde el móvil.
- Estadísticas/reportes de entregas y de visitas espontáneas (habilitados por `origen`, pero sin UI).
- Web: detalle de entregas en la vista web de visitas.
