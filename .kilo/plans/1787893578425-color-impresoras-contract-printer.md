# Color de identidad por impresora en contrato (badge del alias)

Continuación directa del plan de alias (`.kilo/plans/1787888666901-alias-impresoras-contract-printer.md`, ya implementado). El alias nombra el "puesto" que la máquina ocupa en el contrato; el color es su **pista visual** para identificación rápida (especialmente en captura de lecturas en campo, donde cruzar fila de pantalla ↔ impresora física es el flujo más frágil).

## Decisiones de diseño (acordadas con el usuario)

1. **Asignación automática, sin picker**: al crear contrato / asignar impresora, el backend asigna el **primer color libre** de una paleta de 8 keys entre las asignaciones **ACTIVAS** del contrato. Cero UI de selección. Con >8 activas se reutiliza por módulo (aceptado; el texto del alias siempre visible, el color es pista secundaria — accesibilidad/daltonismo).
2. **Persistido** en `contract_printer.color` (string nullable, key de paleta). La fila liberada **conserva** su color como evidencia histórica (mismo criterio que el alias). Sin índice único: la unicidad intra-contrato es política soft con fallback, no invariante de datos.
3. **Herencia en reemplazo, best-effort** (mismo mecanismo que el alias): `releasePrinter` congela `color` en `datos_adicionales` del evento `LIBERACION_CONTRATO`; `InstallationPage` móvil lo re-envía como `color` opcional en `POST assign-printer`; el backend lo usa si es una key válida y está libre, si no → fallback auto. **Color ocupado nunca es error** (no bloquear una instalación en campo).
4. **Estilo "identidad, no estado"**: punto de color + fondo pastel + texto oscuro (NO badge sólido — ese territorio es de los badges de estado: `contract_status`, severidad, etc.). No competir semánticamente con rojo=error.
5. **El backend es la fuente de verdad de las keys**; web y móvil mapean key→hex localmente (patrón existente de `frontend/src/types/colors.ts` con `ColorSet {DEFAULT, foreground, background}`).

## Paleta (8 keys, en orden de asignación)

Keys **sin acentos** (viven en DB): `azul → turquesa → verde → ambar → naranja → morado → rosa → gris`

| key       | dot (DEFAULT) | background | foreground |
|-----------|---------------|------------|------------|
| azul      | `#1D4ED8`     | `#DBEAFE`  | `#1E3A8A`  |
| turquesa  | `#0F766E`     | `#CCFBF1`  | `#134E4A`  |
| verde     | `#15803D`     | `#DCFCE7`  | `#14532D`  |
| ambar     | `#B45309`     | `#FEF3C7`  | `#78350F`  |
| naranja   | `#C2410C`     | `#FFEDD5`  | `#7C2D12`  |
| morado    | `#7C3AED`     | `#EDE9FE`  | `#4C1D95`  |
| rosa      | `#DB2777`     | `#FCE7F3`  | `#831843`  |
| gris      | `#475569`     | `#E2E8F0`  | `#1E293B`  |

(Escala 700/100/900 tipo Tailwind; texto oscuro sobre fondo pastel cumple contraste AA. Evita el rojo puro para no colisionar con `error`/`CRITICA`.)

## Backend (Laravel)

**1. Migración** `backend/database/migrations/2026_08_28_100000_add_color_to_contract_printer_table.php`
- `Schema::table('contract_printer', ...)`: `$table->string('color', 20)->nullable();`
- **Backfill idempotente** en `up()`: por contrato, filas `activa = true AND color IS NULL` ordenadas por `(fecha_asignacion, id)` → key `KEYS[i % 8]` (loop PHP; dataset chico).
- `down()`: `dropColumn('color')`.

**2. Paleta** — nuevo `backend/app/Support/PrinterColorPalette.php`
- `final class PrinterColorPalette { public const KEYS = ['azul','turquesa','verde','ambar','naranja','morado','rosa','gris']; }`

**3. Modelos**
- `ContractPrinter` (`backend/app/Models/ContractPrinter.php`): `'color'` en `$fillable`.
- `Contract::printers()` (`backend/app/Models/Contract.php:67`): `'color'` en el array de `withPivot` (arrastra a `activePrinters` → alimenta `VisitResource`).

**4. `ContractService`** (`backend/app/Services/ContractService.php`)
- `assignPrinter(...)` (línea 111): nuevo parámetro **final** `?string $color = null` (callers posicionales existentes — `create()`, `ContractController` — no se rompen). Resolver color:
  - si `$color` ∈ `PrinterColorPalette::KEYS` **y** no está en uso por activas del contrato → usarlo (herencia);
  - si no → `primerColorLibre()`: `ContractPrinter::where('contrato_id', ...)->where('activa', true)->pluck('color')` → primer key libre; sin libre → `KEYS[$usados->count() % 8]`.
  - Incluir `'color' => $resuelto` en el `attach` y en `datos_adicionales` del evento `ASIGNACION_CONTRATO`.
- `releasePrinter()` (línea 180): leer también `color` de la fila activa (junto al `alias`, línea ~182) y congelarlo en `datos_adicionales` del evento `LIBERACION_CONTRATO`.
- `updateAssignmentAlias()`: **sin cambios** (el color es independiente del alias; renombrar/limpiar alias no toca color).

**5. `ContractController::assignPrinter()`** (línea 73)
- Validación: `'color' => ['nullable', 'string', Rule::in(PrinterColorPalette::KEYS)]` (key inválida → 422). Pasar al servicio como 7º argumento. Color ocupado NO es error → fallback auto dentro del servicio.
- Wizard (`store` / `StoreContractRequest`): sin cambios (el servicio auto-asigna).

**6. Resources**
- `ContractResource::printerAssignmentToArray` (~línea 98): `'color' => $printer->pivot->color,`
- `VisitResource::resolveImpresoras` (~línea 70): `'color' => $printer->pivot?->color,`
- `VisitResource::cambios_impresoras` (~línea 37): `'color' => $h->datos_adicionales['color'] ?? null,` (alimenta la herencia en móvil)
- `ReadingResource` (~línea 27): campo `impresora_color` espejo exacto de `impresora_alias` (`assignments->firstWhere('contrato_id', ...)?->color`, solo si `relationLoaded('assignments')`).

**7. Seeder** `ContractSeeder`: `'color' => PrinterColorPalette::KEYS[$aliasIndex % 8],` en el insert (~línea 61) para que la demo muestre el feature.

**8. Tests** `backend/tests/Feature/ContractPrinterColorTest.php` (espejar helpers privados del `ContractPrinterAliasTest`):
- Contrato con 2 impresoras → `impresoras[].color` = `['azul','turquesa']` (distintos, en orden).
- 3ª asignación → `'verde'`; liberar la 1ª → nueva asignación sin `color` toma `'azul'` (primer libre).
- `assign-printer` con `color` válido y libre → lo respeta; con color ya ocupado → 200 + fallback al primer libre; con key inválida → 422.
- Eventos `ASIGNACION_CONTRATO` y `LIBERACION_CONTRATO` congelan `datos_adicionales.color`; la fila liberada conserva su color.
- >8 activas → módulo (la 9ª repite `'azul'`).
- `PATCH /contracts/{id}/assignments/{id}` (renombrar alias) no altera el color.
- `GET /readings/{id}` → `impresora_color` presente.

## Frontend web (SPA)

**9. Tipos y paleta**
- `frontend/src/types/contract.ts`: `PrinterAssignment` += `color?: string | null` (~línea 10).
- `frontend/src/types/operations.ts`: `VisitPrinter` += `alias?: string | null; color?: string | null` (~línea 10); `VisitPrinterChange` += `alias?: string | null; color?: string | null` (~línea 40); `Reading` += `impresora_color?: string | null`.
- `frontend/src/types/colors.ts`: `printerColorPalette: Record<string, ColorSet>` con los 8 keys (mismo shape `DEFAULT/foreground/background`).

**10. Componente `AliasBadge`** — nuevo `frontend/src/components/ui/AliasBadge.tsx`
- Props `{ alias: string; color?: string | null; className?: string }`.
- Pill con `background` pastel + texto `foreground` + punto 8px `DEFAULT` delante del alias (inline style, patrón de `Badge.tsx:30-39`). Fallback a estilo neutral si `color` es null o key desconocida.

**11. Usos**
- `ContractDetail.tsx` ~453: `<Badge variant="neutral">{pa.alias}</Badge>` → `<AliasBadge alias={pa.alias} color={pa.color} />`; ídem ~616 (lista histórica: el `({pa.alias})` pasa a AliasBadge — las liberadas conservan color).
- **Extensión** (páginas que hoy no muestran el alias aunque la API ya lo envía): `VisitDetailPage.tsx` sección impresoras (~316-334) y `CaptureReadingPage.tsx` header de tarjeta de impresora (~193-199) → `AliasBadge` junto a marca/modelo cuando `imp.alias` exista.
- `ReadingListPage.tsx` columna `impresora_nombre` (~línea 76): punto de color delante del nombre cuando exista `impresora_color` (dot-only; el texto ya es el nombre priorizado).

## App móvil (`/m/`)

**12. Tipos y paleta**
- `mobile/src/types/api.ts`: `VisitPrinter` += `color?: string | null` (~línea 31); `PrinterChange` += `color?: string | null` (~línea 82).
- Nuevo `mobile/src/lib/printerColors.ts`: `printerColorPalette` (dot/bg/fg hex) + helper `printerDotStyle(color)` → estilo inline del punto.

**13. Puntos de UI** (punto 10px antes del alias; sin cambiar jerarquía del texto)
- `CaptureReadingPage.tsx` ~362-366: dot + alias (título) en la tarjeta de captura.
- `VisitDetailPage.tsx` ~283-286 (título de impresora) y ~397-398 (línea "Alias: ...").
- `RemovalPage.tsx` ~156-159 (impresora seleccionada) y ~194-197 (lista de selección).

**14. Herencia en `InstallationPage.tsx`**
- Junto al prefill de alias (~55-61): capturar también `color` del evento `LIBERACION_CONTRATO` (`c.evento === 'LIBERACION_CONTRATO' && c.alias && c.color`), guardarlo y enviarlo como `color` en el POST `/contracts/{id}/assign-printer` (~101-106). Invisible para el usuario.

## Validación

```bash
docker compose exec app php artisan migrate
docker compose exec app php artisan test --filter=ContractPrinterColorTest
docker compose exec app php artisan test --filter=ContractPrinterAliasTest   # regresión
docker compose run --rm --no-deps frontend sh -c "npm run build"
docker compose run --rm --no-deps mobile sh -c "npm run build"
```

Manual (hard refresh en `http://localhost:8080`, móvil en `/m/`): contrato demo con 2-3 impresoras → badges con colores distintos en detalle de contrato; visita LECTURA en `/m/` → dots en captura y visita; retiro + instalación de reemplazo → hereda alias **y** color; listado de lecturas web → dot junto al nombre.

## Fuera de alcance

- Picker manual / edición posterior del color (el PATCH sigue siendo solo alias).
- Identidad de color cross-contrato (por impresora o por cliente).
- Colores en exportes (PDF/Excel) y en field records.
- Cambios en `updateAssignmentAlias` y en el wizard de creación de contrato.

## Riesgos / notas

- Si se olvida el `withPivot('color')`, `pivot?->color` = null → fallback neutral silencioso (no rompe nada, solo pierde el color).
- Colores repetidos solo con >8 impresoras activas por contrato (caso raro; texto siempre presente).
- Coexistencia con badges de estado: el estilo punto+pastel los distingue; **no** usar fondo sólido saturado.
- El reenvío de `color` desde móvil es best-effort: si otra asignación lo tomó mientras tanto, el backend asigna el primer libre sin fallar la instalación.
