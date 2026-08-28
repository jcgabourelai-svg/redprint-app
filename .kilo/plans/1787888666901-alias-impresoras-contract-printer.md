# Plan: Alias de impresoras por asignación de contrato

## Contexto y decisión de diseño

El alias ("Recepción", "Taller") nombra el **puesto que la máquina ocupa dentro del contrato del cliente**, no la máquina física (eso ya lo hacen `num_serie` único y `num_inventario`). Por tanto vive en el pivot `contract_printer` (una fila por impresora↔contrato, unique por par, con ventana `fecha_asignacion`/`fecha_liberacion`). Al rotar flota (retiro → instalación), la fila liberada **conserva** el alias como evidencia histórica y la nueva asignación lo **hereda por sugerencia de UI** (editable), sin lógica server-side de herencia.

**Decisiones confirmadas con el usuario:**
1. **Unicidad**: índice único parcial `(contrato_id, alias) WHERE activa = true AND alias IS NOT NULL` (patrón ya usado por `invoice_details.lectura_id`, principio duro #5 del proyecto).
2. **Edición posterior**: endpoint dedicado `PATCH /contracts/{contract}/assignments/{assignment}` para renombrar el alias de una asignación **activa**.
3. **Lecturas**: `ReadingResource.impresora_nombre` prioriza alias → `alias ?? num_inventario ?? num_serie ?? modelo`.

**Fuera de alcance (explícito):**
- Alias para impresoras sin contrato ("Stock" queda cubierto por estado `EN_ALMACEN` + `almacen_id`).
- Tabla `printer_positions` (posiciones como entidad de primera clase) — evolución futura si se necesitan métricas por posición.
- Wire-up de los botones decorativos "Asignar"/"Liberar" de `ContractDetail.tsx`.
- Búsqueda por alias en el listado de impresoras (requiere join al pivot).

**Invariantes tocadas:** ninguna (no toca dinero ni stock; metadato descriptivo). **Decisiones §8:** extiende historial-evidencia y #5 (integridad en BD). **Permisos:** sin claves nuevas; todo bajo `contratos` existente.

---

## Tareas

### Backend

**1. Migración** `backend/database/migrations/2026_08_28_000001_add_alias_to_contract_printer_table.php`
- `Schema::table('contract_printer', ...)`: `$table->string('alias', 60)->nullable();`
- Índice único parcial vía `DB::statement` (el Schema Builder no soporta `WHERE` en unique):
  ```sql
  CREATE UNIQUE INDEX contract_printer_alias_active_unique
  ON contract_printer (contrato_id, alias)
  WHERE activa = true AND alias IS NOT NULL
  ```
  Seguir el patrón de la migración del índice parcial de `invoice_details.lectura_id`.
- `down()`: drop index + drop column.

**2. Modelos**
- `ContractPrinter`: agregar `'alias'` a `$fillable`.
- `Contract::printers()` y `activePrinters()` (`backend/app/Models/Contract.php:66-71`): agregar `'alias'` al array de `withPivot`.
- `Printer`: nueva relación `assignments(): HasMany` → `hasMany(ContractPrinter::class, 'impresora_id')` (para resolver alias en lecturas sin N+1).

**3. `ContractService`**
- `assignPrinter(..., ?string $alias = null)` — **parámetro nuevo al final** (callers posicionales existentes: `ContractController`, `FieldRecordService::link` — no se rompen). Normalizar `trim('') → null`. Pre-check de duplicado activo (mensaje claro en español) **y** catch de violación del índice (SQLSTATE 23505) → `BusinessRuleException` (el índice es el backstop). Incluir alias en el `attach`.
- Registrar el alias en `datos_adicionales` de los eventos `ASIGNACION_CONTRATO` y `LIBERACION_CONTRATO` de `PrinterHistory` (evidencia congelada).
- `create()` (wizard): pasar `$printerData['alias'] ?? null` por cada impresora.
- **Nuevo** `updateAssignmentAlias(Contract $contract, ContractPrinter $assignment, ?string $alias)`: exigir `$assignment->activa === true` (422 si no); mismas reglas de unicidad; `$assignment->update(['alias' => $alias])`. Un renombramiento **no** escribe `PrinterHistory` (administrativo; el valor histórico ya quedó en los eventos de asignación/liberación). `alias: null` limpia el alias (permitido).

**4. `ContractController` + rutas**
- `store()` (wizard): agregar `'impresoras.*.alias' => 'nullable|string|max:60'` a la validación.
- `assignPrinter()` (`ContractController.php:72`): agregar `'alias' => 'nullable|string|max:60'`; pasarlo al servicio.
- **Nuevo endpoint**: `PATCH contracts/{contract}/assignments/{assignment}` → `updateAssignmentAlias`. Resolver la asignación con `ContractPrinter::where('contrato_id', $contract->id)->findOrFail($assignmentId)` (pertenencia al contrato). Validar `'alias' => 'nullable|string|max:60'`. Responder `ContractResource($contract->fresh(['client', 'printers']))`.
- Registrar la ruta en `backend/routes/api.php` junto a `assign-printer`/`release-printer` (líneas ~112-113) para heredar el mismo grupo y middleware de permisos.

**5. Resources**
- `ContractResource::printerAssignmentToArray` (~línea 92): `'alias' => $printer->pivot->alias`.
- `VisitResource::resolveImpresoras` (~línea 63): `'alias' => $printer->pivot?->alias`.
- `VisitResource::cambios_impresoras` (~línea 33): agregar `'alias' => $h->datos_adicionales['alias'] ?? null` (alimenta el pre-fill de reemplazo en móvil).
- `ReadingResource`: `impresora_nombre` pasa a priorizar el alias resuelto vía `$this->printer?->assignments->firstWhere('contrato_id', $this->contrato_id)?->alias`, **solo si** `$this->printer->relationLoaded('assignments')` (nunca lazy-load — smell §11.5). Cadena: `alias ?? num_inventario ?? num_serie ?? modelo`. Agregar además campo explícito `impresora_alias` (`whenLoaded`).
- Ajustar eager loads de `ReadingController` (`index`, `show`, `getByVisit`, `getByPrinter`): `'printer.assignments'`. Revisar también los `readings` cargados en `VisitController::show` si aplica.

**6. Seeder demo (opcional, recomendado)**
- `ContractSeeder`: asignar alias ("Recepción", "Contabilidad") a asignaciones activas sembradas para que la demo muestre el feature.

### Frontend web

**7. Tipos** — `frontend/src/types/contract.ts`: `PrinterAssignment` += `alias?: string | null`.

**8. Wizard `CreateContract.tsx`**
- Estado `aliases: Record<string, string>` (mismo patrón que `lecturas_iniciales`, líneas 63/127).
- Paso 2, bloque de lecturas iniciales (~líneas 412-437): agregar por impresora un `Input` "Alias / ubicación" con placeholder "Ej. Recepción" y help "Cómo la identifica el cliente en el sitio (opcional)".
- Payload (`handleCreate`, ~línea 105): `alias: aliases[printerId]?.trim() || null`.

**9. `ContractDetail.tsx`**
- Tarjeta de asignación activa (~líneas 318-330): Badge/chip con `pa.alias` junto al título; lista histórica (~línea 466) también lo muestra.
- Edición inline: botón (icono lápiz) en asignaciones activas → modal pequeño con input → `PATCH contracts/{id}/assignments/{pa.id}` con `{ alias }` (react-query mutation + invalidate de la query del contrato, mismo patrón que las mutaciones existentes de la página; `parseApiError` para errores, toast éxito/error).
- NO conectar los botones "Asignar"/"Liberar" (fuera de alcance).

**10. Sin cambios de código** — `ReadingListPage`, `ReadingDetailPage`, `VisitDetailPage` web: `impresora_nombre` ya viene del backend y pasará a priorizar alias. Solo verificación visual.

### Móvil

**11. Tipos** — `mobile/src/types/api.ts`: `VisitPrinter` += `alias?: string | null` (línea 25); `PrinterChange` += `alias?: string | null` (línea 78).

**12. `VisitDetailPage.tsx`**
- Sección impresoras (~líneas 263-290): título `{p.alias ?? `${p.marca} ${p.modelo}`}`, serie como subtítulo.
- Lecturas registradas: usan `r.impresora_nombre` (llega solo con el cambio backend).

**13. `CaptureReadingPage.tsx`** — el lookup de la impresora en `visit.impresoras` ya existe: mostrar alias en el encabezado/tarjeta de la impresora cuando exista, serie debajo.

**14. `InstallationPage.tsx`**
- Campo opcional "Alias / ubicación (Ej. Recepción)" junto a "Lectura inicial" (~líneas 186-198), visible al seleccionar impresora.
- Incluir `alias` en el POST a `/contracts/{id}/assign-printer` (~línea 90).
- **Pre-fill de reemplazo**: si `visit.cambios_impresoras` contiene un evento `LIBERACION_CONTRATO` con `alias`, usarlo como valor inicial editable del campo (la impresora que se retira libera su "puesto").

**15. `RemovalPage.tsx` (menor)** — mostrar el alias de la impresora a retirar si está en `visit.impresoras`.

### Tests

**16. `backend/tests/Feature/ContractPrinterAliasTest.php`** (patrón de `SpontaneousVisitTest`: `RefreshDatabase`, helper `adminUser` con rol `es_sistema`, modelos directos):
- Crear contrato vía `POST /contracts` con `impresoras: [{id, lectura_inicial, alias}]` → pivot con alias; `ContractResource` lo expone.
- Alias duplicado activo en el mismo contrato → 422 (ejercicio del pre-check **y** del índice parcial — los tests corren contra pgsql `redprint_test`).
- Mismo alias en contratos distintos → OK.
- Liberar y reasignar con el mismo alias → OK (la fila liberada no cuenta para el índice parcial).
- `PATCH` renombra asignación activa → 200; sobre inactiva → 422; duplicado → 422; `alias: null` limpia → 200.
- Lectura creada para impresora con asignación con alias → `GET` lectura muestra `impresora_nombre = alias`.

---

## Verificación

```bash
docker compose exec app php artisan migrate
docker compose exec app php artisan test
# Fronts (rebuild obligatorio para ver cambios — AGENTS.md):
docker compose run --rm --no-deps frontend sh -c "npm run build"
docker compose run --rm --no-deps mobile   sh -c "npm run build"
# Recargar http://localhost:8080 con Ctrl+F5
```

Verificación manual del flujo completo: crear contrato con 2 impresoras con alias → ver detalle de contrato → capturar lectura desde `/m/` (ver alias en visita y captura) → retirar impresora → instalar reemplazo (alias pre-llenado) → historial de lecturas muestra el alias.

## Riesgos y edge cases

- **Tests contra pgsql** (`phpunit.xml`): índice parcial soportado; `RefreshDatabase` lo recrea en cada corrida.
- **Múltiples NULL** permitidos por el filtro `IS NOT NULL` del índice.
- **Case-sensitive**: "Recepción" ≠ "recepción" — aceptado, documentar.
- `FieldRecordService::link` llama `assignPrinter` con 5 args posicionales — el parámetro nuevo es opcional al final, sin ruptura.
- Al liberar no se borra el alias: queda congelado en la fila y en `PrinterHistory` (evidencia, §8).
- El build de frontends vacía `dist` sin borrar la carpeta (D14) — usar los comandos tal cual, nunca `rm -rf dist`.
