# Plan: Rebuild del módulo Movimientos + actualización del análisis

> Objetivo: implementar la recomendación para el módulo **Movimientos** (§3 del
> análisis `analisis-redundancia-columna-acciones.md`) y actualizar ese documento.
>
> **Importante:** durante el análisis se descubrió que el módulo está roto de raíz
> (no solo "2 botones muertos"). Este plan corrige el mapeo de la lista, las stats,
> elimina la columna "Acciones" muerta, añade un modal de detalle de solo lectura
> mediante fila clickeable, y **elimina** el botón/modal "Nuevo Movimiento" (sin
> backend).

---

## 1. Contexto y hallazgos (verificado en código)

**Payload real** del backend (`InventoryMovementResource.php` + `routes/api.php:63-64`):

```jsonc
{
  "id": 1,
  "articulo_id": 7,
  "article": { "id": 7, "nombre": "...", "modelo_sku": "...", /* ArticleResource */ },
  "tipo_movimiento": "ENTRADA" | "SALIDA" | "AJUSTE",   // enum MovementType
  "cantidad": 10,
  "stock_anterior": 0,
  "stock_posterior": 10,
  "referencia_tipo": "INVENTARIO_INICIAL" | "MANTENIMIENTO" | "AJUSTE" | "compra" | null,
  "referencia_id": null | 123,
  "justificacion": "...",
  "fecha": "2025-12-01",                                 // Y-m-d
  "socio": { "id": 1, "nombre": "...", "correo": "..." },// UserResource | null
  "fecha_creacion": "2025-12-01T..."                      // datetime
}
```

**Bugs confirmados en el frontend actual** (`MovementList.tsx`):

- La lista rendera campos **inexistentes**: `articulo_nombre`, `almacen_nombre`,
  `almacen_id`, `tipo`, `estado`, `motivo`, `responsable`, `costo_unitario` → celdas vacías.
- En el backend **no existe** columna/relación `almacen`, ni `estado`, ni `motivo`
  (movimientos = registro de auditoría inmutable; `tipo_movimiento` ya define entrada/salida/ajuste).
- Stats `entradasMes`/`salidasMes` filtran por `m.tipo` (undefined) → **siempre 0**.
- El modal "Nuevo Movimiento" recolecta campos sin backend y **no hay ruta POST/store**
  (solo `index` + `show`). Hoy solo cierra.
- Columna "Acciones": `Eye` y `Trash2` **sin `onClick`** (muertos). Tampoco hay `DELETE`.

**Consumidores del tipo `InventoryMovement`**: solo `MovementList.tsx` (grep verificado).
→ Cambiar el tipo es **contenido y seguro**.

**Componente `Table`**: su `<tr>` (`Table.tsx:335-342`) usa `onClick` pero NO
`tabIndex`/`onKeyDown`/`role`. La a11y de teclado queda **pospuesta** (deuda doc §5.3);
**no se toca `Table.tsx`** en este plan → otros módulos intactos.

---

## 2. Decisiones fijadas (acordadas con el usuario)

| # | Decisión | Valor |
|---|----------|-------|
| 1 | Alcance | **Rebuild completo** al esquema real del API |
| 2 | Origen de datos del modal | **Reusar el item de la lista** (sin llamar `show`) |
| 3 | "Nuevo Movimiento" | **Eliminar** botón + modal (no hay endpoint de creación) |
| 4 | Backend | **Sin cambios** (`index` ya trae todo lo necesario) |
| 5 | a11y fila clickeable | **Pospuesta** (click-only); nota como deuda (doc §5.3) |

---

## 3. Tareas

### T1 — Actualizar el tipo `frontend/src/types/inventory-movement.ts`

Redefinir `InventoryMovement` al payload real:

```ts
export type MovementType = 'ENTRADA' | 'SALIDA' | 'AJUSTE'

export interface InventoryMovement {
  id: number
  articulo_id: number
  article: { id: number; nombre: string; modelo_sku?: string | null } | null
  tipo_movimiento: MovementType
  cantidad: number
  stock_anterior: number
  stock_posterior: number
  referencia_tipo: string | null
  referencia_id: number | null
  justificacion: string | null
  fecha: string            // 'Y-m-d'
  socio: { id: number; nombre: string; correo?: string } | null
  fecha_creacion: string   // ISO datetime
}
```

- Eliminar campos obsoletos: `tipo`, `articulo_nombre`, `almacen_id`, `almacen_nombre`,
  `motivo`, `estado`, `responsable`, `referencia`, `notas`, `costo_unitario`.
- Eliminar `MovementReason` y `MovementStatus` si quedan sin uso tras T2.
- Si `MovementType` ya existe en `./enums`, reusarlo; si no, definirlo aquí y borrar el
  import roto.

### T2 — Reescribir `frontend/src/pages/inventory/movements/MovementList.tsx`

**Eliminar:**
- Imports no usados tras la refactorización: `Plus`, `Eye`, `Trash2`, `Modal`, `Input`
  y (si solo los usaba el modal) `useWarehouses`, `useArticles`, `useUsers`.
  - Mantener: `ArrowLeftRight`, `ArrowDown`, `ArrowUp` (stats), `ArrowUpDown` si aplica,
    `Badge`, `Card/CardContent`, `Table`, `Button` (limpiar filtros), `Select` (filtro),
    `PageLayout`, `api`, `useServerTable`, `formatDate`/`formatDateTime`, el tipo.
- Estado/lógica del modal de creación: `showNewMovement`, `movementForm`, los maps
  `motivosEntrada`/`motivosSalida`/`motivoLabels`, y el fetch de warehouses/articles/users.
- La sección `<Button>Nuevo Movimiento</Button>` y todo el `<Modal>...Registrar Movimiento...</Modal>`.
- La **columna `acciones`** (con `Eye`/`Trash2` muertos).

**Reconstruir `columns`** con campos reales (todas `sortable` donde el backend soporte
orden: `id`, `fecha`, `tipo_movimiento`, `cantidad` — ver `$this->applySorting` allow-list):

| Columna | Render |
|---------|--------|
| ID | `row.id` |
| Artículo | `row.article?.nombre ?? '—'` + subtexto `#{row.articulo_id}` |
| Tipo | `<Badge variant={ENTRADA?'success':SALIDA?'warning':'info'}>` `tipo_movimiento` |
| Cantidad | `{cantidad} uds` (color éxito/advertencia según tipo) |
| Stock | `{stock_anterior} → {stock_posterior}` (delta de auditoría) |
| Origen | `referenciaTipoLabel(referencia_tipo)`; si `referencia_id`, envolver en `<a>`/`<button>` → link |
| Responsable | `row.socio?.nombre ?? '—'` |
| Fecha | `formatDate(row.fecha)` |

**Fila clickeable + modal de detalle (solo lectura):**
- Estado: `const [selected, setSelected] = useState<InventoryMovement | null>(null)`.
- `<Table ... onRowClick={(row) => setSelected(row)} />`.
- Nuevo `<Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Detalle del Movimiento">`
  mostrando: Tipo (Badge), Artículo (nombre + sku), Cantidad, **Stock anterior → posterior**
  (resaltar el delta), Origen (label + link navegable si `referencia_id`), Justificación,
  Responsable (`socio.nombre`), Fecha (`formatDate(fecha)`) y Registrado el (`formatDateTime(fecha_creacion)`).
  Pie con botón **Cerrar**.

**Helpers locales (en el mismo archivo):**
```ts
const referenciaTipoLabel: Record<string, string> = {
  INVENTARIO_INICIAL: 'Inventario inicial',
  MANTENIMIENTO: 'Mantenimiento',
  AJUSTE: 'Ajuste',
  COMPRA: 'Compra', compra: 'Compra',
}
function referenciaLink(t: string | null, id: number | null): string | null {
  if (!id) return null
  const k = (t ?? '').toUpperCase()
  if (k === 'COMPRA') return `/finanzas/compras/${id}`
  if (k === 'MANTENIMIENTO') return `/inventario/mantenimiento/${id}`
  return null
}
```
(El link usa `navigate(...)` de `react-router-dom` ya usado en otras páginas; si no está
importado, añadir `useNavigate`.)

**Stats (fix):**
- `entradas = movements.filter(m => m.tipo_movimiento === 'ENTRADA').length`
- `salidas  = movements.filter(m => m.tipo_movimiento === 'SALIDA').length`
- Tarjeta "Total Movimientos": usar `tableProps.totalItems` (global) en vez de
  `movements.length` (que es solo la página actual).
- **Caveat documentado:** Entradas/Salidas reflejan la página cargada, no el total global.
  Dejar un `<span>` aclaratorio discreto o anotarlo (no ampliar alcance).

**Filtro (mantener, ya correcto):**
- El `Select` de `tipoFilter` ya envía `tipo_movimiento` (ENTRADA/SALIDA/AJUSTE) y el
  backend lo filtra. Conservar tal cual + botón "Limpiar filtros".

### T3 — Backend

**Sin cambios.** `index` devuelve todo lo que la lista y el modal necesitan. No se añade
`store`/`destroy` (la creación manual queda fuera de alcance; los movimientos los generan
compras/mantenimiento/ajustes vía `InventoryService`).

### T4 — Actualizar `analisis-redundancia-columna-acciones.md`

- **§1 (tabla resumen), fila #3 Movimientos:** actualizar veredicto a:
  *"✅ Hecho — lista reconstruida al esquema real del API, columna 'Acciones' muerta
  quitada, fila clickeable → modal de solo lectura, 'Nuevo Movimiento' eliminado (sin
  backend). a11y de teclado pospuesta (§5.3)."*
- **§3.3 Movimientos:** reescribir con el hallazgo real (mapeo equivocado, stats en 0,
  sin ruta POST) y la solución implementada.
- **§5.1:** marcar `MovementList.tsx` `Eye`/`Trash2` (`:181-186`) como ✅ resueltos (eliminados).
- **§5.2:** añadir/incorporar que el modal "Nuevo Movimiento" sin backend se resolvió
  **eliminándolo** (no cableando, porque no hay endpoint y el dominio es auditoría inmutable).
- **§5.3:** añadir nota: Movimientos es ahora módulo de fila clickeable sin columna →
  a11y de teclado pospuesta (deuda transversal).

---

## 4. Validación

1. Build del front (según `AGENTS.md`):
   `docker compose run --rm --no-deps frontend sh -c "npm run build"`
2. Lint (si está disponible): `cd frontend; npm run lint`
3. Smoke test en `http://localhost:8080` (Ctrl+F5), ruta `/inventario/movimientos`:
   - Las columnas muestran datos reales (artículo, tipo, stock, origen, responsable, fecha).
   - Las tarjetas Total/Entradas/Salidas ≠ 0 y coherentes.
   - Click en una fila abre el modal de detalle con todos los campos.
   - El filtro por tipo funciona y "Limpiar filtros" resetea.
   - **No** aparece el botón "Nuevo Movimiento" ni la columna "Acciones".
   - `referencia_id` nulo → origen como texto (sin link); con id → link navegable.
4. Regresión: revisar que **no** se tocó `components/ui/Table.tsx` (otros módulos intactos).

---

## 5. Riesgos / notas

- **Stats por página:** Entradas/Salidas cuentan solo la página cargada (no el total).
  Mitigación: usar `tableProps.totalItems` para "Total"; documentar la limitación en UI.
- **`referencia_id` nulo** en los seeders (`INVENTARIO_INICIAL`, `MANTENIMIENTO`) → la
  mayoría de filas mostrarán el origen como texto sin link. Esperado.
- **Cambio de tipo contenido:** solo `MovementList.tsx` importa `InventoryMovement`
  (grep verificado). Sin riesgo para otras páginas.
- **a11y pospuesta:** usuarios de teclado no podrán abrir el modal (deuda §5.3, decisión
  del usuario). No tocar `Table.tsx` en este plan.
- **`getMovementTypeColor` (`formatters.ts`)** usa claves en minúsculas que no coinciden
  con el enum; no se usa en la refactorización (se usan variantes de `Badge`). Dejarlo sin tocar.

## 6. Fuera de alcance

- Añadir endpoint `POST`/`DELETE` para movimientos (creación/borrado manual).
- a11y de teclado en filas clickeables (cambio en `Table.tsx` compartido).
- Reconstruir los demás módulos del Grupo A/B (planes separados).
