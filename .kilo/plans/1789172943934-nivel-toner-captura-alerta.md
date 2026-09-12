# Plan: Captura de nivel de tóner + alerta TONER_LOW

> Origen: análisis de `ideas/niveltoner.md` contra el código real (sesión 2026-09-12).
> Alcance acordado con el usuario: **Fase 1 completa (captura + es_color) + alerta de tóner bajo**.
> Fuera de alcance: TonerService (estimados, pendiente, rendimiento real), widget dashboard con
> días-para-agotarse, costo por página real (Fases 2 y 4 del documento de ideas).

## Decisiones cerradas (no reabrir durante la implementación)

1. **Almacenamiento**: jsonb `niveles_toner` nullable en `readings` y `field_records`, formato
   `{k, c, m, y}` con valores `int 0-100` o null. **Claves cerradas** (whitelist), nada de json
   arbitrario.
2. **UX de captura**: chips `[⚠️ Bajo(10)] [25] [50] [75] [100]` + input libre 0-100 opcional.
   Lo cualitativo es solo afordancia de UI; siempre se guarda número. "Bajo" = 10 (convención).
3. **Color**: columna `printer_models.es_color` (boolean, default false) con **backfill automático**
   desde el pivote `article_printer_model` (modelo con tóners Ciano/Magenta/Amarillo vinculados
   ⇒ true). El móvil muestra C/M/Y automáticamente si `es_color`; fallback: disclosure manual
   "+ Colores".
4. **Alerta**: al guardar una lectura con **cualquier color capturado ≤ 15%** (constante), crear
   notificaciones `tipo='TONER_LOW'` a usuarios con permiso `operaciones.lecturas` + el
   `socio_id` de la lectura. Dedupe por impresora mientras exista una no-leída vigente. No
   dispara si la lectura tiene más de 7 días de antigüedad (regularización diferida de field
   record). Nace del evento de captura: **sin scheduler**.
5. **D1 (dinero) intacto**: el nivel jamás entra a `InvoiceCalculationService`,
   `monto_estimado`, `ProfitabilityService` ni ninguna respuesta de facturación.
6. `niveles_toner` es **informativo**: nunca genera 422 de negocio, bloqueos ni anormalidad.

## Contexto clave verificado en el código

- `ReadingService::captureReading` pasa `$data` directo a `Reading::create` (ReadingService.php:63)
  ⇒ basta fillable+cast, el servicio no cambia (salvo el hook de alerta, Bloque 3).
- `FieldRecordService::link()` construye el payload de lectura **campo por campo**
  (FieldRecordService.php:112-122): el passthrough de `niveles_toner` es un cambio explícito;
  sin él, la regularización pierde el nivel **sin error** (el agujero silencioso más fácil de pasar por alto).
- SyncManager postea `item.payload` verbatim (sync.ts:119-123) y el store IndexedDB usa
  `keyPath:'id'` sin validar forma (db.ts:67) ⇒ **no bump de `DB_VERSION`**, la cola offline
  transporta el campo sin cambios (D5 intacto).
- Patrón de notificaciones: `InventoryService.php:137-163` (`User::withPermission` + dedupe por
  no-leídas + `referencia_tipo/referencia_id`). Reutilizar tal cual.
- `ContractPrinter.color` / `VisitPrinter.color` es el **color-etiqueta del alias**, NO capacidad
  CMY. El campo nuevo se llama `es_color` en todos los payloads; no reutilizar `color`.
- `printers.printer_model_id` es NOT NULL y `Printer::printerModel` existe (Printer.php:57).
- Permiso `operaciones.lecturas` ya existe (config/permisos.php:42); no hay permiso nuevo.
- El tab "Alertas" del móvil ya lista notificaciones por tipo ⇒ TONER_LOW aterriza gratis.
- BD: PostgreSQL.

---

## Tareas

### Bloque 1 — Backend: columna `niveles_toner`

1. **Migración** `backend/database/migrations/2026_09_12_000001_add_niveles_toner_to_readings_table.php`:
   `$table->jsonb('niveles_toner')->nullable()` tras `paginas_periodo`. `down()` la elimina.
2. **Migración** `..._000002_add_niveles_toner_to_field_records_table.php`: ídem en
   `field_records` (tras `valor_contador`).
3. **Modelos**: `Reading` y `FieldRecord` — añadir `niveles_toner` a `$fillable` y
   `'niveles_toner' => 'array'` a `casts()`.
4. **Validación lecturas** (`StoreReadingRequest::rules`):
   ```php
   'niveles_toner' => ['nullable', 'array:k,c,m,y'],
   'niveles_toner.k' => ['nullable', 'integer', 'min:0', 'max:100'],
   'niveles_toner.c' => ['nullable', 'integer', 'min:0', 'max:100'],
   'niveles_toner.m' => ['nullable', 'integer', 'min:0', 'max:100'],
   'niveles_toner.y' => ['nullable', 'integer', 'min:0', 'max:100'],
   ```
   Mensajes en español (patrón existente). `array:k,c,m,y` rechaza claves fuera de la whitelist.
5. **Validación field records** (`StoreFieldRecordRequest`): mismas reglas. No requiere
   `required_if` — es opcional siempre.
6. **`ReadingResource`**: exponer `'niveles_toner' => $this->niveles_toner`.
7. **`FieldRecordResource`**: exponer `niveles_toner` (para la bandeja web).
8. **Passthrough de regularización** — `FieldRecordService::link()`, en el array literal que se
   pasa a `captureReading` (~línea 112-122), añadir:
   `'niveles_toner' => $record->niveles_toner,`

### Bloque 2 — `es_color` en catálogo de modelos

9. **Migración** `..._000003_add_es_color_to_printer_models_table.php`:
   - `$table->boolean('es_color')->default(false)` en `printer_models`.
   - Backfill (heurística sobre el pivote ya catalogado):
     ```php
     $colorModelIds = DB::table('article_printer_model as apm')
         ->join('articles as a', 'a.id', '=', 'apm.article_id')
         ->where('a.subtipo', 'TONER')
         ->where(fn ($q) => $q->where('a.nombre', 'ilike', '%ciano%')
             ->orWhere('a.nombre', 'ilike', '%magenta%')
             ->orWhere('a.nombre', 'ilike', '%amarillo%'))
         ->pluck('apm.printer_model_id');
     DB::table('printer_models')->whereIn('id', $colorModelIds)->update(['es_color' => true]);
     ```
10. **`PrinterModel`**: `es_color` en `$fillable`.
11. **`PrinterModelController`** store/update + `StorePrinterModelRequest`:
    aceptar/persistir `'es_color' => 'nullable|boolean'` (default false). Exponerlo en index/show.
    (No hay página admin de modelos; el backfill cubre los datos sembrados y la API permite
    corregir. UI de edición: fuera de alcance.)
12. **`VisitResource::resolveImpresoras()`** (VisitResource.php:74-86): añadir
    `'es_color' => (bool) ($printer->printerModel?->es_color ?? false)` a cada impresora.
    Evitar N+1: extender los eager loads `contract.activePrinters` a
    `contract.activePrinters.printerModel` en `VisitController` (líneas ~43, ~69 y ~95) y
    donde más se sirva `VisitResource` con impresoras (grep `activePrinters` en controllers).

### Bloque 3 — Alerta TONER_LOW

13. **Servicio nuevo** `backend/app/Services/TonerAlertService.php`:
    - Constante `public const UMBRAL = 15;` y `FRESCURA_DIAS = 7;`
    - Método `evaluar(Reading $reading, Printer $printer): void` — llamado desde
      `ReadingService::captureReading` justo tras `Reading::create` (misma transacción; insert
      simple, sin try/catch):
      - Skip si `$reading->fecha < today()->subDays(FRESCURA_DIAS)` (regularización rancia).
      - Recopilar claves con valor ≤ UMBRAL; si ninguna, return.
      - Skip si existe `Notification` no leída con `tipo='TONER_LOW'`,
        `referencia_tipo='Printer'`, `referencia_id=$printer->id` (dedupe, patrón INVENTORY_LOW).
      - Destinatarios: `User::withPermission('operaciones.lecturas')->get()` +
        `$reading->socio_id`, deduplicados por id.
      - `Notification::create` por destinatario:
        `tipo='TONER_LOW'`, `titulo='Tóner bajo'`,
        mensaje `"Tóner bajo (K: 10%) en {marca} {modelo}{alias} — {razon_social del cliente}"`
        listando cada color bajo (K=Negro, C=Cian, M=Magenta, Y=Amarillo),
        `referencia_tipo='Printer'`, `referencia_id=$printer->id`, `fecha=now()`.
      - El cliente se resuelve desde `$reading->contrato_id` (Contract::find) sin lazy-load en
        loop; con datos nulos, degradar el mensaje con gracia.

### Bloque 4 — Móvil (`mobile/`)

14. **`src/lib/db.ts`**: en `ReadingPayload` y `FieldRecordPayload` añadir
    `niveles_toner?: { k?: number; c?: number; m?: number; y?: number } | null`.
    Nada más (sin bump de DB_VERSION).
15. **`src/types/api.ts`**: `VisitPrinter.es_color?: boolean`; `Reading.niveles_toner?: {...} | null`.
16. **Componente nuevo** `src/components/TonerLevelInput.tsx`:
    - Props: `value: number | null`, `onChange: (v: number | null) => void`, `label: string`
      (ej. "Negro"), `tone` opcional para CMY.
    - Chips: `⚠️ Bajo(10) / 25 / 50 / 75 / 100` con estado seleccionado + input numérico libre
      0-100 opcional (si difiere de los chips, deselecciona chips). Estilo consistente con los
      componentes `ui` existentes.
17. **`CaptureReadingPage.tsx`**: sección colapsable "Nivel de tóner (%)" debajo del contador:
    - Fila K siempre visible.
    - Si `printer.es_color`: filas C/M/Y visibles. Si no: link discreto "+ Es de color" que las
      revela (fallback por catálogo desactualizado).
    - Al armar el payload: incluir `niveles_toner` solo con claves con valor; omitir el campo
      completo si todo es null.
    - Mostrar en la tarjeta de resultado (post-guardado) los niveles capturados.
18. **`NewFieldRecordPage.tsx`** (paridad D15): sección colapsable igual (impresora no
    catalogada ⇒ sin `es_color`): K visible + "+ Colores" para C/M/Y. Incluir en
    `FieldRecordPayload` solo si hay valores.

### Bloque 5 — Web (`frontend/`)

19. **`ReadingDetailPage.tsx`**: si `niveles_toner` presente, card/línea con chips por color
    (K negro, C cian, M magenta, Y amarillo; valor ≤ 20 ⇒ estilo "Bajo" rojo/ámbar).
20. **`FieldRecordsPage.tsx`**: en el detalle del registro pendiente, mostrar los niveles
    (mismos chips) — informa la regularización.
21. **`PrinterDetail.tsx`** (pestaña lecturas): por entrada de lectura con niveles, chips
    compactos (K y CMY si existen).
22. Columna en `ReadingListPage.tsx`: **opcional**, solo si sobra tiempo; no bloqueante.

### Bloque 6 — Tests backend (nuevo `tests/Feature/TonerLevelTest.php`)

Patrón de `ReadingAnomalyThresholdTest` (role/user/contract/printer/visit helpers). Casos:

1. Store lectura con `niveles_toner: {k:25, c:null}` → 201, persistido, resource lo expone.
2. `k:101` → 422; `k:"abc"` → 422; `niveles_toner: {foo:50}` → 422 (claves cerradas).
3. Lectura sin `niveles_toner` → 201 (retrocompatibilidad).
4. Field record LECTURA con niveles → `link()` produce lectura con `niveles_toner` (el
   passthrough del Bloque 1.8 — el test que protege el agujero silencioso).
5. Lectura con `k:10` → notificaciones `TONER_LOW` para usuarios con `operaciones.lecturas` y
   el socio capturista; no para usuarios sin permiso.
6. Segunda lectura baja de la misma impresora con notificación no leída ⇒ no duplica.
7. Lectura regularizada con `capturado_en` 20 días atrás y `k:10` ⇒ sin notificación (frescura).
8. Lectura con `k:40` ⇒ sin notificación.

### Bloque 7 — Verificación y build (Docker, nunca host)

```bash
docker compose exec app php artisan migrate
docker compose exec app php artisan test
docker compose run --rm --no-deps frontend sh -c "npm run build"
docker compose run --rm --no-deps mobile sh -c "npm run build"
```

Hard refresh en `http://localhost:8080` (Ctrl+F5). Probar captura móvil en `/m/` online y
offline (modo avión → cola → reconexión).

---

## Riesgos / gotchas para el implementador

- **No tocar** los scripts `npm run build` (vacían `dist` sin borrar la carpeta — bind mount).
- Si aparece 500 en `/` tras rebuild: `docker compose restart nginx` (AGENTS.md).
- La alerta se dispara también vía regularización de field record (mismo `captureReading`):
  la guardia de frescura (7 días por `fecha`) es la que evita alertas rancias.
- `fecha` en `readings` es cast `date` ⇒ comparar con `today()->subDays(7)` en Carbon.
- No crear índices nuevos: volúmenes pequeños; `TonerService` real (Fase 2) decidirá después.
- Mantener los nombres en español del payload (`niveles_toner`, `es_color`) — consistencia D15.
- `niveles_toner` con todas las claves en null ⇒ guardar null (normalizar en el Request o en el
  servicio; evitar `{}` ruidoso en BD).

## Criterios de aceptación

- Lectura con niveles se captura en móvil online y offline y llega íntegra a BD.
- Lectura/field record sin niveles se comporta exactamente igual que hoy (retrocompat).
- Field record LECTURA con niveles, regularizado, produce lectura con niveles.
- Tras backfill, los modelos con tóners CMY en el pivote quedan `es_color=true`; el resto false.
- Captura con cualquier color ≤15% genera exactamente una notificación TONER_LOW por
  destinatario, visible en el tab Alertas del móvil y en la web.
- `docker compose exec app php artisan test` verde (tests nuevos + existentes).
- Dists de frontend y móvil recompilados en Docker; cambios visibles en 8080.

## Fuera de alcance (planes futuros)

- `TonerService`: pendiente de consumo, páginas/días restantes, resets detectados,
  rendimiento real (mediana), correlación con `article_deliveries`.
- Widget dashboard "tóner bajo × próxima visita".
- Costo por página real → `ProfitabilityService` (report-only).
- UI web de edición de `es_color` en catálogo de modelos.
