# Plan: Registros de campo (staging) + bandeja de regularización

## Objetivo

Resolver el hueco: en una **visita no programada** donde el cliente no existe en sistema, o la impresora no está registrada / no está en el contrato, hoy el operador **no puede registrar nada** (el picker de `NewVisitPage` solo lista clientes con contrato activo; las lecturas exigen `impresora_id` real). El resultado es que la visita, el conteo y la entrega de tóner **se pierden**.

Solución acordada: **NO dar de alta cliente/contrato/impresora desde el móvil** (el contrato toca dinero, la impresora toca catálogo/inventario — decisiones de admin). En su lugar:

1. **Móvil**: el operador captura un *registro de campo* (staging) con los datos crudos + evidencia (foto/GPS/fecha), **con soporte offline desde el MVP** (cola IndexedDB existente).
2. **Web**: una bandeja "Operaciones › Registros de campo" permite **vincular** el registro a entidades reales (creando la visita + lectura + entregas en una transacción) o **descartarlo con motivo**.
3. Si el cliente/contrato/impresora no existen, el admin los da de alta primero con los flujos web existentes y luego vincula.

## Decisiones cerradas (con el usuario)

| # | Decisión |
|---|---|
| D-A | Salida de stock del tóner se registra **al regularizar** (una sola transacción: `ArticleDelivery` + kardex). Aceptado desfase: fecha del kardex = fecha de regularización; el registro conserva la fecha física como evidencia. |
| D-B | Instalación implícita al vincular: `lectura_inicial` = **contador capturado** ⇒ `paginas_periodo = 0` (línea base, no se cobra histórico previo). |
| D-C | **Offline desde el MVP**: la captura del móvil siempre pasa por la cola del `SyncManager` (un solo code path online/offline). |
| D-D | No hay alta de cliente/contrato/impresora desde el móvil (fuera de alcance explícito). |
| D-E | Los registros vinculados/descartados son **inmutables** (no hay endpoint de edición; re-link ⇒ 422). |

## Modelo de datos (tabla nueva `field_records`)

Migración: `backend/database/migrations/2026_08_26_000003_create_field_records_table.php`

```
id
tipo              enum('LECTURA','ENTREGA_INSUMOS','OTRO')        -- OTRO = evidencia genérica (falla, instalación/retiro sin registro, pura visita)
estado            enum('PENDIENTE','VINCULADO','DESCARTADO')      -- default PENDIENTE
-- datos crudos reportados (texto libre)
nombre_cliente_reportado  string not null
direccion_reportada       string null
marca_reportada           string null
modelo_reportado          string null
num_serie_reportado       string null
valor_contador            integer null        -- obligatorio si tipo=LECTURA (validación en Request)
articulos_entregados      json null           -- [{descripcion, cantidad}] texto libre del operador
notas                     text null
-- evidencia inmutable (el hecho no se reescribe)
foto_evidencia            text null           -- data-URI (mismo formato que readings)
ubicacion_lat/lng         decimal(10,7) null
capturado_en              timestamp not null  -- fecha física real (la manda el móvil; permite offline)
client_uuid               string null unique  -- dedup de sync offline (POST ambiguo no duplica)
socio_id                  FK users not null
creado_por                FK users not null
-- vinculación (todo null hasta regularizar)
cliente_id, contrato_id, impresora_id, visita_id, lectura_id   FK null
vinculado_por             FK users null
vinculado_en              timestamp null
motivo_descarte           text null
timestamps
índices: (estado), (socio_id), unique(client_uuid)
```

En la **misma migración**, insertar el permiso nuevo inline (patrón de `0001_..._000036_create_xml_comprobantes_table.php:80`):

```php
Permission::firstOrCreate(['clave' => 'operaciones.registros-campo'], ['etiqueta' => 'Registros de campo', 'modulo' => 'operaciones']);
```

Y agregarlo a `backend/config/permisos.php` (módulo `operaciones`). `RolePermissionSeeder` sincroniza TODOS los permisos al rol `operador` (idempotente, corre en el entrypoint), así que el permiso queda otorgado sin cambios adicionales. `operador-inventario` NO lo recibe (prueba negativa igual que visitas).

**No se toca** `readings`, `printers`, `visits` ni `article_deliveries`.

## FASE 1 — Backend

### 1.1 Enums + Model + Resource

- `backend/app/Enums/FieldRecordType.php`: `LECTURA, ENTREGA_INSUMOS, OTRO`
- `backend/app/Enums/FieldRecordStatus.php`: `PENDIENTE, VINCULADO, DESCARTADO`
- `backend/app/Models/FieldRecord.php`: `$fillable`, casts (tipo, estado, capturado_en, vinculado_en, articulos_entregados=>array), relaciones BelongsTo: `client`, `contract`, `printer`, `visit`, `reading`, `socio`, `vinculadoPor`. Columnas en español como el resto del dominio.
- `backend/app/Http/Resources/FieldRecordResource.php`: incluir relaciones cargadas cuando existan (`whenLoaded`).

### 1.2 Request + Controller + Rutas

- `backend/app/Http/Requests/StoreFieldRecordRequest.php` (patrón `StoreVisitRequest`):
  - `tipo` required|in:LECTURA,ENTREGA_INSUMOS,OTRO
  - `nombre_cliente_reportado` required|string|max:255
  - `valor_contador` required_if:tipo,LECTURA|integer|min:0
  - `direccion_reportada|marca_reportada|modelo_reportada|num_serie_reportado|notas` nullable|string
  - `articulos_entregados` nullable|array; `articulos_entregados.*.descripcion` required_with|string; `articulos_entregados.*.cantidad` required_with|integer|min:1
  - `foto_evidencia` nullable|string (data-URI); `ubicacion_lat/lng` nullable|numeric
  - `capturado_en` nullable|date (default `now()` en el controller)
  - `client_uuid` nullable|uuid|unique:field_records,client_uuid
- `backend/app/Http/Controllers/FieldRecordController.php` (patrón `VisitController`):
  - `index`: with(`socio`, `client`, `contract`, `printer`), filtros `estado/tipo/socio_id/search` (search sobre `nombre_cliente_reportado`/`num_serie_reportado`), `Sortable`, `paginate(per_page ?? 15)`
  - `show`, `store`
  - `link(Request, FieldRecord)` → valida y delega a `FieldRecordService::link`
  - `discard(Request, FieldRecord)` → valida `motivo_descarte|required|string` y delega
- Rutas en `backend/routes/api.php` (sección Operaciones):

```php
Route::middleware('permission:operaciones.registros-campo')->group(function () {
    Route::apiResource('field-records', FieldRecordController::class)->only(['index', 'show', 'store']);
    Route::post('field-records/{fieldRecord}/link', [FieldRecordController::class, 'link']);
    Route::post('field-records/{fieldRecord}/discard', [FieldRecordController::class, 'discard']);
});
```

### 1.3 Servicio `backend/app/Services/FieldRecordService.php`

**`create(array $data, User $user): FieldRecord`**
- Dedup idempotente: si llega `client_uuid` y ya existe, devolver el registro existente (200/no duplicar; protege reintento de sync ambiguo — cubre la deuda conocida §10 móvil para esta tabla nueva).
- Estampa `socio_id = $user->id`, `creado_por`, `estado = PENDIENTE`, `capturado_en`.

**`link(FieldRecord $record, array $data, User $admin): FieldRecord`** — TODO en `DB::transaction`:

Payload de entrada:
```
cliente_id*, contrato_id*, impresora_id* (para LECTURA; null si no aplica),
justificacion_anomalia? (LECTURA), articulos?: [{articulo_id*, cantidad*}] (ENTREGA_INSUMOS),
tipo_visita? + motivo_cierre? (solo OTRO)
```

1. Guard: `estado === PENDIENTE` si no `BusinessRuleException` (inmutabilidad D-E).
2. Resolver contrato: existe, pertenece al cliente y `ACTIVO` (422 con mensaje accionable si no).
3. Crear **visita** `origen=CAMPO`, `fecha_programada = capturado_en->toDateString()`, `tipo_visita`:
   - `LECTURA → LECTURA`, `ENTREGA_INSUMOS → ENTREGA_INSUMOS`
   - `OTRO → tipo_visita` del payload (required, enum de 5 valores de visitas)
   - `socio_id = record->socio_id` (el operador de campo, no el admin), `creado_por = admin`.
4. Resolver impresora (solo LECTURA):
   - Si está en el contrato (pivot `activa`) → usar tal cual.
   - Si `EN_ALMACEN` → **instalación implícita**: `ContractService::assignPrinter($contract, $printer->id, $record->valor_contador, $admin, visitaId: $visit->id)` (D-B: `lectura_inicial = contador capturado`; el evento queda en `PrinterHistory` con `visita_id`).
   - Si no (`RENTADA` en otro contrato, etc.) → `BusinessRuleException` con mensaje que indique resolver manualmente.
5. Por tipo:
   - **LECTURA**: extender `ReadingService::captureReading()` con parámetro opcional `?User $creadoPor = null` (backwards-compatible; hoy hardcodea `creado_por = $creator`) y llamar con: `visita_id`, `impresora_id`, `contrato_id`, `fecha = capturado_en`, `valor_contador`, `justificacion_anomalia`, `foto_evidencia` (copiar data-URI del registro), ubicación; `socio = record->socio`, `creadoPor = $admin`. El **servidor** calcula `paginas_periodo` y valida anomalía (si el contador retrocede vs la última lectura y no hay justificación ⇒ 422 que la UI revela). `captureReading` puede auto-completar la visita (todas las impresoras del contrato leídas).
   - **ENTREGA_INSUMOS**: por cada `articulos[]` mapeado → `DeliveryService::deliver($visit, articulo_id, cantidad, $record->socio)` (salida de stock con lock + snapshot de costo + `ArticleDelivery`; D-A).
   - **OTRO**: solo la visita.
6. Si la visita sigue `PENDIENTE` tras las actividades → `VisitService::complete($visit, 'Regularizado desde registro de campo')`. Nota aceptada: `fecha_realizada` = fecha de regularización.
7. Estampar en el registro: `cliente_id, contrato_id, impresora_id, visita_id, lectura_id` (primera lectura si hubo), `vinculado_por = admin`, `vinculado_en = now()`, `estado = VINCULADO`. Return `$record->fresh(load relations)`.

**`discard(FieldRecord $record, string $motivo, User $admin)`**: guard PENDIENTE, `motivo` no vacío, `estado = DESCARTADO` + `motivo_descarte`.

### 1.4 Seeder + tests

- `backend/database/seeders/FieldRecordSeeder.php`: 3 registros demo (uno PENDIENTE con lectura+foto fake, uno VINCULADO, uno DESCARTADO). Registrarlo en `DatabaseSeeder.php`.
- `backend/tests/Feature/FieldRecordTest.php` (patrones de `SpontaneousVisitTest`: helpers `adminUser()` es_sistema y `userWithPermissions()`):
  1. `store` crea PENDIENTE con socio = usuario autenticado.
  2. `store` LECTURA sin `valor_contador` ⇒ 422 validación.
  3. `store` idempotente por `client_uuid` (2 POST ⇒ misma fila, `assertDatabaseCount(...,1)`).
  4. Sin permiso (`inventario.articulos` only) ⇒ 403 en index/store/link.
  5. `link` LECTURA con impresora ya en contrato ⇒ visita `CAMPO` + lectura con `paginas_periodo` correcto + registro VINCULADO con `lectura_id` + stock intacto.
  6. `link` LECTURA con impresora `EN_ALMACEN` ⇒ pivot con `lectura_inicial = valor_contador`, lectura `paginas_periodo = 0`, `PrinterHistory` con `visita_id`, visita COMPLETADA.
  7. `link` LECTURA con retroceso de contador sin justificación ⇒ 422; con justificación ⇒ ok y `es_anomalia = true`.
  8. `link` LECTURA con impresora `RENTADA` en otro contrato ⇒ 422.
  9. `link` ENTREGA con 2 artículos ⇒ 2 `article_deliveries` + 2 movimientos kardex SALIDA + stock decrementado.
  10. `link` dos veces ⇒ 422 (inmutabilidad).
  11. `discard` sin motivo ⇒ 422; con motivo ⇒ DESCARTADO.
  12. `link` OTRO con `tipo_visita` elegido ⇒ visita creada y COMPLETADA con motivo de cierre.
  13. `link` contrato de otro cliente / contrato no ACTIVO ⇒ 422.

## FASE 2 — Bandeja web (`frontend/`)

### 2.1 Tipos y enums

- `frontend/src/types/`: interfaz `FieldRecord` (snake_case tal cual la API) y tipos de payload.
- `frontend/src/types/enums.ts`: `fieldRecordStatusLabels` (PENDIENTE=ámbar, VINCULADO=verde, DESCARTADO=gris) + `fieldRecordTypeLabels` con colores, siguiendo el patrón `*Labels` existente.

### 2.2 Navegación y rutas

- `frontend/src/config/nav.ts`: bajo `operaciones` → `{ id: 'registros-campo', label: 'Registros de campo', path: '/operaciones/registros-campo', permiso: 'operaciones.registros-campo' }`.
- `frontend/src/App.tsx`: ruta con `RequirePermission`.

### 2.3 Páginas (anatomía de listado §9 de PROJECT.md)

- **`pages/operations/FieldRecordsPage`** (o convención de carpetas existente): `PageLayout` título "Operaciones › Registros de campo" → KPI "N pendientes de regularizar" → filtros plegables (estado, tipo, socio, search) → tabla `useServerTable` (server-side) con columnas: fecha (`capturado_en`), tipo (Badge), cliente reportado, serie reportada, socio, estado (Badge). Row click → modal de detalle. `EmptyState` solo sin filtros: CTA informativo "Los operadores capturan desde la app móvil (/m/)".
- **Modal de vinculación (wizard 3 pasos** — patrón §9.3, terminando en confirmación que **advierte efectos**):
  1. **Destino**: picker cliente (search) → contratos ACTIVOS del cliente → impresora: las activas del contrato + opción "asignar desde almacén" (listado `GET /printers?estado=EN_ALMACEN`); hint con links a `/clientes` y `/contratos` para "dar de alta primero" (la integración de retorno automático post-alta queda fuera de alcance MVP).
  2. **Mapeo**: según tipo — LECTURA: muestra contador capturado, lectura previa calculada y campo condicional de `justificacion_anomalia` (también se revela si el server responde 422, patrón móvil); ENTREGA: filas `articulos_entregados` (texto libre) junto a selectores artículo/cantidad (`GET /articles` activos); OTRO: select `tipo_visita` + `motivo_cierre`.
  3. **Resumen + confirmar**: consecuencias explícitas ("Se creará una visita CAMPO del {fecha}, se registrará la lectura (N páginas)…" / "…saldrán X unidades de stock").
- **Descartar**: modal danger con motivo obligatorio (copy honesto).
- Feedback con `Toast` + `parseApiError`; montos/formatos vía helpers existentes si aplica.

### 2.4 Visibilidad (opcional pero recomendado)

- Widget/badge en Dashboard: "N registros de campo pendientes" (filtrado por permiso, sin número hardcodeado — evitar el smell §10 de la campana "3").

## FASE 3 — Móvil (`mobile/src/`) — offline desde el MVP (D-C)

### 3.1 Cola offline (extensión mínima)

- `lib/db.ts`: `QueueItem.type` pasa a `'reading' | 'field_record'`; nueva `FieldRecordPayload` (todos los campos crudos + `client_uuid: string` + `capturado_en: string`). No hay que subir `DB_VERSION` (el store no cambia de esquema).
- `lib/sync.ts`: `enqueueFieldRecord(payload)`; en `sync()` el dispatch por `item.type`: `reading → POST /readings`, `field_record → POST /field-records`. Clasificación de errores intacta (red ⇒ reintenta; 4xx ⇒ estado `error` visible/descartable). El dedup real lo hace el server por `client_uuid` (1.3).

### 3.2 Captura

- **`pages/NewFieldRecordPage.tsx`** ruta `/registro-campo` (en `App.tsx`, estática antes de `visita/:id`):
  - Form corto 1 pantalla: tipo (LECTURA/ENTREGA_INSUMOS/OTTO con labels "Contador"/"Entrega de insumos"/"Otro"), nombre del lugar* (requerido), dirección, marca/modelo/n° serie (texto libre), `valor_contador` (numérico, requerido si LECTURA, teclado numérico), filas dinámicas descripción+cantidad (si ENTREGA), notas, **foto** (reusar `lib/photo.ts`: canvas JPEG ≤1280px q0.7 data-URI), GPS opcional (reusar lógica de `CaptureReadingPage`).
  - Al enviar: `client_uuid = crypto.randomUUID()`, `capturado_en = new Date().toISOString()` → **siempre** `enqueueFieldRecord(...)` (D-C: un solo code path; si hay red sincroniza al instante). Toast: "Registro en cola / sincronizado". El botón funciona **con y sin conexión**.
  - Visible solo con permiso `operaciones.registros-campo` (hook `hasPermission`).
- **Entradas**: CTA en el `EmptyState` de `NewVisitPage` cuando la búsqueda de cliente no arroja resultados ("¿El cliente no está en sistema? Registrar visita no catalogada →") y botón secundario en el encabezado de `VisitsPage`.
- `ProfilePage`: contador de registros propios pendientes en la cola (usa el snapshot del `SyncManager`).
- Actualizar `mobile/README.md` (nueva pantalla, tipo de item en la cola, limitación: la regularización es web).

## FASE 4 — Docs y verificación

### 4.1 Docs

- `mobile/README.md` (arriba).
- `PROJECT.md`: actualizar §5 (entidad FieldRecord), §8 (nueva decisión ligera: staging + regularización diferida, extiende D4/D5), mapa de permisos (19→20 claves en D9 y §12), §10 (quitar/nada que agregar; opcionalmente notar que `field_records` SÍ resuelve el dedup que lecturas no tiene).

### 4.2 Comandos de verificación (en orden)

```bash
docker compose exec app php artisan migrate          # nueva tabla + permiso
docker compose exec app php artisan test             # suite completa (incluye FieldRecordTest)
docker compose exec app php artisan config:cache     # cambió config/permisos.php y routes/api.php
docker compose run --rm --no-deps frontend sh -c "npm run lint && npm run build"
docker compose run --rm --no-deps mobile   sh -c "npm run lint && npm run build"
```

### 4.3 Checklist E2E manual (el escenario original del problema)

1. Login móvil como `operador1@redprint.com` → Nueva visita → buscar cliente inexistente → CTA "Registrar visita no catalogada".
2. Llenar: LECTURA, "Tacos El Güero", serie reportada, contador 12345, foto → enviar **con el wifi apagado** → toast "en cola".
3. Encender red → el indicador (⟳) sincroniza → registro visible como PENDIENTE en la bandeja web.
4. En web: dar de alta cliente + contrato (wizard existente) + crear impresora en almacén → volver a la bandeja → vincular eligiendo la impresora de almacén.
5. Verificar: visita `CAMPO` COMPLETADA, `contract_printer.lectura_inicial = 12345`, lectura con `paginas_periodo = 0`, `PrinterHistory` con `visita_id`, registro VINCULADO e inmutable (re-link ⇒ 422).
6. Repetir con ENTREGA_INSUMOS: verificar kardex SALIDA y `article_deliveries`.
7. Descartar uno sin motivo ⇒ 422 visible; con motivo ⇒ DESCARTADO.
8. `mvp1@redprint.com` (operador-inventario) no ve la bandeja ni la pantalla móvil (403/oculto).

## Riesgos y notas para el implementador

- **`ReadingService::captureReading`**: extender con `?User $creadoPor` opcional — cambio backwards-compatible; no alterar el cálculo de `paginas_periodo` ni la validación de anomalía (D1/D6).
- **No** crear impresoras/clients placeholder ni hacer nullable `impresora_id` en `readings` — contaminaría catálogo, unicidad de `num_serie` y rentabilidad.
- `articulos_entregados` queda como evidencia cruda; la salida de stock nace solo del mapeo del admin (D-A). Si el operador entregó un artículo que no existe en catálogo, el admin lo crea antes de vincular.
- Foto como data-URI en `text` (mismo approach que `readings.foto_evidencia` — consistencia antes que optimización).
- Todos los textos de UI en español con tildes correctas (D10); montos vía `formatCurrency` si se muestran.
- No usar `window.confirm`; destructivos con modal danger del design system.
