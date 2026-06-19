# Plan: Búsqueda + Orden + Paginación server-side reutilizable

## Objetivo
Hacer que **todas las tablas** (11 vistas listadas + el wrapper `WarehouseTable`) realicen
**búsqueda, orden y paginación en el servidor** sobre el dataset completo, con **debounce**
para no spamear el backend, mediante un patrón **reutilizable** (1 hook + 1 componente `Table`
que ya soporta props controladas). Hoy la mayoría de vistas filtran/ordenan/paginean en cliente
(solo sobre la página visible), y la búsqueda no encuentra registros de otras páginas.

Enfoque acordado con el usuario:
- **Phasing**: Fase 1 = infra + `ArticleList` como referencia completa; Fase 2 = migrar el resto.
- **Unificar el param de búsqueda a `search`** (renombrar `buscar` → `search` en `ArticleController`).

---

## Estado actual (inventario)

### Frontend — consumidores de `@/components/ui/Table`
| Vista | Paginación | Search | Sort |
|-------|-----------|--------|------|
| ArticleList | server ✅ | **local ❌** | controlada ✅ |
| PrinterList | server ✅ | controlada ✅ (debounce 400ms) | local ❌ |
| MaintenanceList | server ✅ | local ❌ | local ❌ |
| MovementList | server ✅ **roto** (doble filtro cliente) | local ❌ | local ❌ |
| ReadingListPage | local ❌ | local ❌ | local ❌ |
| ReceivablesList | local ❌ | local ❌ | local ❌ |
| PaymentList | local ❌ | local ❌ | local ❌ |
| PurchaseList | local ❌ | local ❌ | local ❌ |
| InvoiceList | local ❌ | local ❌ | local ❌ |
| ContractList | local ❌ | local ❌ | local ❌ |
| ClientList | local ❌ | local ❌ | local ❌ |
| WarehouseTable (wrapper) | ninguna | ninguna | local |

- El componente `Table` **ya tiene** todas las props controladas: `searchValue`/`onSearchChange`,
  `sortColumn`/`sortDirection`/`onSortChange`, `currentPage`/`totalPages`/`onPageChange`/`totalItems`,
  `filterState`/`onFilterChange`. El problema es que cada vista las cablea a mano (o no las cablea).
- No existe utilidad de debounce en `src/lib/`. PrinterList usa `setTimeout` inline.
- Paginación se lee como `data?.meta?.last_page ?? data?.last_page` y `data?.meta?.total ?? data?.total`
  (las **Resource collections** anidan en `meta`; el **paginador crudo** lo deja en raíz). El hook debe
  manejar ambos.

### Backend — endpoints `index` paginados
- **Search inconsistente**: `buscar` (solo Article), `search` (Printer, Client, Invoice, Supplier,
  Warehouse, User). **Sin** search: Contract, Visit, Reading, Payment, MaintenanceOrder,
  InventoryMovement, Expense, Purchase, SupplierPayment, Notification, AuditLog.
- **Sort hardcoded** en todos salvo `ArticleController` (único con `sort_by`/`sort_dir` validados).
- **per_page** por defecto: 15 (CRUD) / 20 (operativos) / 50 (audit-log).
- Respuesta: mayormente **Resource collection**; crudo en `ArticleController` y `AuditLogController`.
- DB = **Postgres** → usar `ilike` en búsqueda.

---

## FASE 1 — Infraestructura + referencia (ArticleList)

### Backend
**1. Crear trait `App\Traits\Sortable`** (`backend/app/Traits/Sortable.php`)
- Método `applySorting(Builder $query, Request $request, array $allowedColumns, string $defaultCol = 'created_at', string $defaultDir = 'desc'): void`
  - Lee `sort_by` / `sort_dir`; valida contra allowlist con `in_array(..., true)`; cae a default si inválido.
  - `$sortDir` validado a `asc|desc`.
  - Aplica `$query->orderBy($sortBy, $sortDir)`.
  - Repite exactamente la lógica ya probada en `ArticleController` (sin duplicar: el controller pasará a usar el trait).

**2. Crear trait `App\Traits\Searchable`** (`backend/app/Traits/Searchable.php`)
- Método `scopeSearch(Builder $q, ?string $term, array $columns): Builder`
  - Si `$term` vacío → retorna sin cambios.
  - Sino: agrupa con `$q->where(fn($sub) => …)` y un `orWhere($col, 'ilike', "%{$term}%")` por cada columna.
  - (Detalle de robustez opcional: escapar `%`/`_` literales del término. No es inyección SQL por binding.)

**3. Refactorizar `ArticleController::index`** (`backend/app/Http/Controllers/ArticleController.php`)
- Usar los dos traits: `$query->search($request->search, ['nombre','marca','modelo_sku'])`
  y `$this->applySorting($query, $request, [...allowlist...], 'nombre', 'asc')`.
- **Renombrar `buscar` → `search`** (coincide con el resto). Actualizar la lectura del param.
- Mantener los filtros existentes (`tipo`, `subtipo`, `proveedor_id`, `stock_bajo`, `activo`).
- Dejar `per_page ?? 20`.

### Frontend
**4. Crear hook `useDebounce`** (`frontend/src/hooks/useDebounce.ts`)
- `useDebounce<T>(value: T, delayMs = 350): T` con `useEffect` + `setTimeout` (reemplaza el inline de PrinterList).

**5. Crear hook `useServerTable`** (`frontend/src/hooks/useServerTable.ts`)
```ts
interface Options<T> {
  queryKey: string[]
  fetcher: (params: Record<string, unknown>) => Promise<PaginatedResponse<T>>
  pageSize?: number                 // default 25
  debounceMs?: number               // default 350
  defaultSort?: { column: string; dir: 'asc' | 'desc' }
  extraParams?: Record<string, unknown>   // filtros fijos por vista (estado, fechas, etc.)
}
```
- Estado: `page`, `search` (input inmediato), `debouncedSearch` (vía `useDebounce`),
  `sortColumn`, `sortDirection`.
- `params` (memo) = `{ page, per_page, search: debouncedSearch || undefined,
  sort_by: sortColumn || undefined, sort_dir: sortDirection, ...extraParams }`.
- `useQuery({ queryKey: [...queryKey, params], queryFn: () => fetcher(params), placeholderData: (prev)=>prev })`.
- Helpers que **reinician a página 1** al cambiar búsqueda/orden/filtros:
  `onSearchChange`, `onSortChange`, y `onFilterChange` (opcional, para filtros server-side).
- Lectura robusta de meta: helper `pickMeta(d)` → `d.meta?.last_page ?? d.last_page`, `d.meta?.total ?? d.total`.
- Devuelve:
  - `data: T[]` (los items de la página actual)
  - `tableProps`: objeto listo para `<Table {...tableProps}>` con
    `{ searchValue, onSearchChange, sortColumn, sortDirection, onSortChange, currentPage,
       totalPages, totalItems, onPageChange, pageSize }`
  - `isLoading`, `error`, `isFetching` (para UI de carga).
- Tipado genérico `<T>`.

**6. Refactorizar `ArticleList`** como referencia (`frontend/src/pages/inventory/articles/ArticleList.tsx`)
- Eliminar `useState(page)`, `useState(sortColumn/sortDirection)` y `handleSortChange` manuales.
- Usar:
  ```ts
  const { data: articles, tableProps, isLoading, error } = useServerTable<Article>({
    queryKey: ['articles'],
    fetcher: (p) => api.get('/articles', { params: p }).then(r => r.data),
  })
  ```
- `<Table {...tableProps} data={articles} columns={columns} searchable sortable paginatable emptyMessage=... onRowClick=... />`
- Conservar `ArticleForm`, modal, toast, etc. sin cambios.

**7. `Table.tsx` — sin cambios mayores** (las props controladas ya existen).
- Solo verificar que con `onSearchChange` provisto, la búsqueda local se omite (`isSearchControlled`)
  y que al enviar `searchValue` controlado el input es controlado. Confirmar lectura de `activeSortColumn`.

### Verificación Fase 1
- **Back**: `docker exec redprint-app php -l` en cada trait/controller; `route:clear`;
  probar query real (`search` + `sort_by`+`sort_dir`) vía script PHP contra DB (asc/desc y filtro).
- **Front**: `npx tsc --noEmit` (filtrar a archivos tocados); `npm run lint`;
  **rebuild dist**: `docker run --rm -v "$PWD/frontend:/app" -w /app node:20-alpine npm run build`.
- **Manual** en `http://localhost:8080/inventario/articulos` (tras rebuild):
  - Escribir "juan" desde página 1 → Network: `GET /articles?search=juan&page=1&sort_by=nombre`
    y ver resultados globales (de cualquier página).
  - Ordenar ID desc → página 1 muestra IDs altos (orden global).
  - Cambiar de página mantiene el filtro/orden.
  - Debounce: al teclear rápido, **una sola** petición tras ~350ms de pausa.

---

## FASE 2 — Migrar las 10 vistas restantes

Por cada vista: (a) ensure backend soporta `search` + `sort_by`/`sort_dir` (vía traits, declarando
sus columnas permitidas), (b) reemplazar el cableado manual por `useServerTable`.

### Backend — migrar controllers (aplicar traits + declarar columnas)
| Controller | Columnas `search` | Columnas `sort` permitidas | default sort |
|------------|-------------------|----------------------------|--------------|
| Printer | codigo_negocio, num_serie, marca | id, codigo_negocio, num_serie, marca, modelo, estado, created_at | created_at desc |
| Client | razon_social, rfc | id, razon_social, rfc, created_at | created_at desc |
| Contract | *(añadir)* codigo_contrato, razon_social via join? → mínimo `codigo_contrato` | id, codigo_contrato, estado, fecha_inicio, fecha_fin, created_at | created_at desc |
| Visit | *(añadir)* cliente (vía relación) — mínimo sin texto o `notas` | id, fecha_programada, estado, created_at | fecha_programada asc |
| Reading | *(añadir, opcional)* | id, fecha, impresora_id, created_at | fecha desc |
| Invoice | numero_factura | id, numero_factura, estado, total, fecha_emision, created_at | created_at desc |
| Payment | *(añadir)* referencia / numero vía factura | id, monto, fecha, created_at | created_at desc |
| Supplier | razon_social | id, razon_social, created_at | razon_social asc |
| Warehouse | nombre | id, nombre, created_at | created_at desc |
| MaintenanceOrder | *(añadir)* descripción | id, fecha, estado, tipo_mantto, created_at | fecha desc |
| InventoryMovement | *(añadir)* referencia | id, fecha, tipo_movimiento, cantidad, created_at | fecha desc |
| Expense | *(añadir)* descripcion | id, fecha, tipo, monto, created_at | fecha desc |
| Purchase | *(añadir)* concepto | id, fecha, estado, total, created_at | fecha desc |
| SupplierPayment | *(añadir)* referencia | id, fecha, monto, created_at | fecha desc |
| Notification | *(añadir)* mensaje | id, created_at, leida | created_at desc |
| AuditLog | *(añadir)* accion, entidad_tipo | id, fecha, accion, entidad_tipo, created_at | fecha desc |
| User | nombre | id, nombre, email, created_at | created_at desc |

- Para cada controller: `$query->search($request->search, [...])` + `$this->applySorting($query, $request, [...], $default, $defaultDir)`.
- Conservar **todos los filtros existentes** (estado, cliente_id, fechas, etc.).
- `AuditLogController` usa paginador crudo envuelto en `['data'=>...]`: el trait de sort aplica igual;
  el hook leerá `meta` (o raíz). Verificar que no rompa el wrapper.
- `per_page`: mantener los defaults actuales por controller (no unificar, para no cambiar UX).

### Frontend — migrar vistas a `useServerTable`
Por cada lista, sustituir el `useX(params)` manual + estado suelto por:
```ts
const { data: items, tableProps, isLoading, error } = useServerTable<X>({
  queryKey: ['x'],
  fetcher: (p) => api.get('/x', { params: p }).then(r => r.data),
  // extraParams cuando haya filtros fijos server-side (p.ej. PrinterList estado/marca)
})
```
- Vistas con **filtros** (PrinterList `estado`/`marca`, ContractList `estado`, MaintenanceList
  `estado/tipo`, fechas, etc.): pasar `extraParams` (stateful) y reiniciar página al cambiar.
  - Opción A (simple): integrar `filterState` dentro de `useServerTable` (añadir `filters`/`onFilterChange`
    al hook). **Recomendado** para uniformidad.
  - El hook devolverá también `filterState`/`onFilterChange` dentro de `tableProps`.
- **Casos especiales a corregir**:
  - **MovementList**: hoy paginador server + doble filtro cliente (`filteredMovements`) con
    `pageSize=10` vs `per_page=10`. Migrar a 100% server-side; eliminar el `useMemo` de filtrado.
    Los `<select>` de artículo/almacén siguen cargándose con `per_page:100` (eso es OK, son combos).
  - **ReadingListPage**: hoy ignora paginación; el hook pasará `socio_capturista`/`fecha_inicio`/`fecha_fin`
    como `extraParams`.
  - Páginas que hoy **no envían params** (Receivables, Payments, Purchases, Invoices, Contracts,
    Clients): ahora envían `search`+`sort`+`page`+filtros, y leen meta del servidor.
- `WarehouseTable` (wrapper, recibe data por props, sin paginación): mantener como está si el
  dataset de almacenes es chico; o migrar su consumidor padre (`WarehouseList`) si conviene.
  Decidir en Fase 2.

### Verificación Fase 2
- Repetir checklist de Fase 1 por cada vista migrada (sort asc/desc global, search global,
  paginación conserva filtros/orden, debounce, `tsc`, `lint`, rebuild dist).

---

## Riesgos y mitigaciones
- **Paginación 0 resultados al buscar**: el hook reinicia a página 1 en cada cambio → OK.
- **Flicker al paginar**: `placeholderData: (prev)=>prev` en el query.
- **Carga completa de combos** (selects de artículo/almacén con `per_page:100`): se mantiene;
  no se ve afectada por el cambio de la lista principal.
- **Endpoints que devuelven meta en `meta` vs raíz**: el hook normaliza con helper `pickMeta`.
- **Sort de columnas con relaciones** (p.ej. ordenar contrato por cliente): fuera del alcance
  inmediato; el allowlist se limita a columnas locales. Se marca en el plan para no prometerlo.
- **Compatibilidad de param `buscar`→`search`**: solo `ArticleList` lo usaba internamente y se migra
  junto; ningún otro cliente consume `buscar`.

## Entregables
- Back: 2 traits (`Sortable`, `Searchable`) + 17 controllers migrados (Article refactor + 16 con sort/search).
- Front: 2 hooks (`useDebounce`, `useServerTable`) + 11 vistas migradas (Article + 10).
- `Table.tsx`: sin cambios estructurales (ya soporta props controladas).
- Verificación: `php -l`, `route:clear`, `tsc`, `eslint`, rebuild `dist`, pruebas manuales por vista.
