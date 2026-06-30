# Plan: Renombrar "Calendario" a "Visitas" + toggle calendario/lista

## Objetivo
En el módulo Operaciones, renombrar la entrada de menú "Calendario" a "Visitas" y dotar a esa vista de un conmutador entre **vista calendario** y **vista lista (tabla)**, eliminando la representación duplicada actual.

## Alcance
- **Dentro:** rename de menú + título, cambio de ruta con redirección, toggle calendario/lista, limpieza de bloques redundantes.
- **Fuera de alcance (tareas separadas, no tocar aquí):**
  - Bug del botón "Nueva visita" (el modal no invoca `useCreateVisit`).
  - Desajuste de tipos `Visit` (frontend) vs `VisitResource` (backend) — campos `cliente_nombre`, `socio_asignado`, `hora_programada`, `impresoras` pueden llegar vacíos. La nueva tabla simplemente renderiza lo que el tipo declara; no se corrige el API en este plan.

## Decisiones acordadas
1. **Ruta:** mover `/operaciones/calendario` → `/operaciones/visitas` (coherente con el detalle existente `/operaciones/visitas/:id`). Ambas rutas coexisten sin conflicto en React Router v6.
2. **Vista lista:** componente `Table` (`@/components/ui/Table`) en **modo client-side** (consume `filteredVisits`, sin `useServerTable`).
3. **Toggle:** interruptor Calendario/Lista en la cabecera. Preferencia persistida en `localStorage` (`redprint.visitas-view`). Defecto inteligente: calendario en desktop (≥1024px), lista en móvil.
4. **Permisos:** se **conservan** la clave `operaciones.calendario` y el `id: 'calendario'` en `nav.ts` (renombres tocarían backend/seed/roles; fuera de alcance).

## Contexto técnico verificado
- `Table.tsx` soporta modo no controlado: con solo `data` + `columns` filtra/busca/ordena/pagina en cliente. Útil para reusar `filteredVisits`.
- `CalendarPage.tsx` ya calcula `filteredVisits` (filtro socio + estado, client-side, líneas 71-77) y `calendarEvents` (79-86). Ambos modos consumen el mismo dato.
- Referencias a `/operaciones/calendario` (botones "Volver"):
  - `VisitDetailPage.tsx`: líneas 64, 87, 98, 120 (4).
  - `CaptureReadingPage.tsx`: líneas 87, 110, 413 (3).
- La card siempre-visible "Visitas del mes" (líneas 204-273) y el bloque móvil en cards (159-202) quedan redundantes con el toggle y se eliminan.

## Tareas (orden de ejecución)

### 1. Navegación — `frontend/src/config/nav.ts`
- Línea 75: cambiar `label: 'Calendario'` → `'Visitas'` y `path: '/operaciones/calendario'` → `'/operaciones/visitas'`.
- **Conservar** `id: 'calendario'`, `icon: Calendar`, `permiso: 'operaciones.calendario'`.

### 2. Rutas — `frontend/src/App.tsx`
- Línea 64: cambiar `path="operaciones/calendario"` → `path="operaciones/visitas"`.
- Añadir redirección de la ruta antigua (junto a la ruta nueva):
  ```tsx
  <Route path="operaciones/calendario" element={<Navigate to="/operaciones/visitas" replace />} />
  ```
  (`Navigate` ya se importa en `App.tsx` línea 2.)
- El detalle `operaciones/visitas/:id` (línea 65) **no se toca**.

### 3. Página principal — `frontend/src/pages/operations/calendar/CalendarPage.tsx`
Reestructurar manteniendo la lógica de datos/filtros existente:

- **Importaciones:** añadir `Table` (`@/components/ui/Table`), `List` y `Calendar` (iconos lucide), y el tipo `Column` de Table si hace falta. Reusar `Badge`, `Button`, `Select`, `formatDate`, `estadoVariant`, `estadoLabels` ya presentes.

- **Estado del toggle con persistencia + defecto inteligente:**
  ```ts
  type VisitView = 'calendario' | 'lista'
  const VIEW_KEY = 'redprint.visitas-view'
  function getInitialView(): VisitView {
    const saved = localStorage.getItem(VIEW_KEY)
    if (saved === 'calendario' || saved === 'lista') return saved
    return window.matchMedia('(min-width: 1024px)').matches ? 'calendario' : 'lista'
  }
  const [view, setView] = useState<VisitView>(getInitialView)
  useEffect(() => { localStorage.setItem(VIEW_KEY, view) }, [view])
  ```

- **Cabecera:** título `<h2>` → "Visitas"; `PageLayout title` → "Operaciones › Visitas" (3 ocurrencias: loading, error y return principal). Subtítulo "Programación y seguimiento de visitas de campo" se mantiene. Añadir el toggle junto al botón "Nueva visita":
  - Interruptor segmentado de 2 botones (`Calendar`/`List` iconos + labels "Calendario"/"Lista"). Activo = `variant="secondary"`, inactivo = `variant="ghost"`. Llama a `setView`.

- **Columnas de la tabla (client-side)** sobre `filteredVisits`:
  - Fecha (`fecha_programada`, sortable, `formatDate`)
  - Cliente (`cliente_nombre`)
  - Socio (`socio_asignado`)
  - Hora (`hora_programada`)
  - # Impresoras (`impresoras?.length ?? 0`)
  - Estado (`estado` → `Badge` con `estadoVariant`/`estadoLabels`)
  - Acciones → botones "Ver" (→ `/operaciones/visitas/:id`) y, si `estado === 'PENDIENTE'`, "Capturar lecturas" (→ `/operaciones/lecturas/:id`). `e.stopPropagation()` en los botones para no disparar `onRowClick`.

- **Render condicional** (sustituye a los bloques actuales):
  ```tsx
  {view === 'calendario'
    ? <Calendar events={calendarEvents} onEventClick={...} onDateClick={...} />
    : <Table data={filteredVisits} columns={columns} searchable sortable paginatable
             emptyMessage="No hay visitas con los filtros seleccionados"
             onRowClick={(v) => navigate(`/operaciones/visitas/${v.id}`)} />
  }
  ```
  - Eliminar el wrapper `hidden lg:block` del calendario (ya no depende del breakpoint).
  - **Eliminar** el bloque móvil en cards (líneas 159-202).
  - **Eliminar** la Card "Visitas del mes" (líneas 204-273) y la función `CalendarIcon` local si queda sin uso.

- **Filtros socio/estado:** se mantienen ( Selects en la cabecera), comunes a ambos modos. La `Table` añade su propia búsqueda sobre las columnas por encima de estos filtros.

### 4. Botones "Volver" — actualizar 7 referencias
Reemplazar `'/operaciones/calendario'` → `'/operaciones/visitas'` en:
- `frontend/src/pages/operations/VisitDetailPage.tsx`: líneas 64, 87, 98, 120.
- `frontend/src/pages/operations/readings/CaptureReadingPage.tsx`: líneas 87, 110, 413.

(Usar `replaceAll` o edición por contexto. Las rutas `/operaciones/visitas/:id` y `/operaciones/lecturas/:id` **no** se tocan.)

## Riesgos y notas
- **Conflictos de icono:** `Calendar` se importa de lucide en `CalendarPage.tsx` (línea 6) pero actualmente **no se usa** el componente tras quitar `CalendarIcon` local; si queda sin uso, quitar la import para evitar lint "unused".
- **`hora_programada` / `cliente_nombre` vacíos:** si el API no los devuelve, la tabla mostrará "-". Es el desajuste conocido (fuera de alcance). No altera la corrección del toggle.
- **Permisos:** el backend sigue usando `operaciones.calendario`; no hay que migrar nada.
- **SSR/`window`:** `getInitialView` usa `window`/`matchMedia`; la app es SPA cliente (BrowserRouter), no hay SSR. Seguro.

## Validación
1. `cd frontend && npm run lint` y typecheck del proyecto (verificar comando en `package.json`).
2. Rebuild del dist en Docker (obligatorio para ver cambios en 8080, según `AGENTS.md`):
   ```bash
   docker compose run --rm --no-deps frontend sh -c "npm run build"
   ```
   - Si aparece HTTP 500 al recargar (mount de nginx en Windows): `docker compose restart nginx`.
3. En `http://localhost:8080` (Ctrl+F5):
   - Menú muestra **Visitas** → `/operaciones/visitas`.
   - La ruta antigua `/operaciones/calendario` redirige a `/operaciones/visitas`.
   - Toggle conmuta entre calendario y tabla; recargar mantiene la elección (localStorage).
   - En móvil (o ancho <1024px) sin preferencia guardada, arranca en **lista**.
   - Filtros socio/estado aplican en ambos modos.
   - En la tabla: "Capturar lecturas" aparece solo en PENDIENTE y navega a `/operaciones/lecturas/:id`.
   - "Volver" desde `VisitDetailPage` y `CaptureReadingPage` regresa a `/operaciones/visitas`.

## Entregables
- 4 archivos modificados: `nav.ts`, `App.tsx`, `CalendarPage.tsx`, `VisitDetailPage.tsx`, `CaptureReadingPage.tsx` (5 en total).
- Dist recompilado y verificado en 8080.
