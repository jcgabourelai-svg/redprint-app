# Plan: Unificar "Hoy" + "Calendario" en una sola vista de Visitas (móvil)

## Contexto

La app móvil (`/m/`) tiene dos páginas casi duplicadas:

- `TodayPage` (`/`, tab 🏠 "Hoy"): chips Hoy/7 días/Mes actual, botón "+ Visita", campana de notificaciones. **Sin** filtro de estado (muestra CANCELADAS/OMITIDAS/COMPLETADAS mezcladas) y sin agrupar por día.
- `CalendarPage` (`/calendario`, tab 📅 "Visitas"): navegador de mes ‹ ›, filtro Activas/Todas, agrupación por día. **Sin** botón "+ Visita" ni campana.

Ambas cargan `GET /visits` con `fetchAll`, renderizan `VisitCard` con skeleton/error/empty, y escuchan `SYNC_DONE_EVENT`. Decisión acordada con el usuario: **unirlas en una sola vista** que abre por defecto en "Hoy" (preserva el caso de uso principal del operador) y agrega las funcionalidades combinadas.

Bug latente que la unificación corrige: en `CalendarPage` el handler de `SYNC_DONE_EVENT` hace `setVisits(null)` pero el efecto de carga depende de `[canOperaciones, cursor]`, así que tras un sync la lista queda en skeleton infinito. La semántica correcta es la de `TodayPage` (`setTick` → re-fetch).

## Decisiones de diseño (acordadas)

1. Nueva página `VisitsPage.tsx`; se eliminan `TodayPage.tsx` y `CalendarPage.tsx`.
2. Chip de período por defecto: **Hoy**. Chips: `Hoy` / `7 días` / `Mes`.
3. El navegador de meses ‹ › **solo aparece con el chip "Mes"** (fila propia, debajo de los chips).
4. Filtro de estado **Activas/Todas siempre visible**, default `Activas` (mismo criterio que CalendarPage: `estado === 'PENDIENTE' || 'REPROGRAMADA'`).
5. Botón **"+ Visita"** siempre visible (misma`Link to="/visita/nueva"` con estilos actuales).
6. Listado **agrupado por día** con `formatDayLabel` (headers estilo CalendarPage, key `'sin-fecha'` → "Sin fecha").
7. Header sticky "RedPrint Operativo" con **campana de notificaciones** (si `sistema.notificaciones`), igual al de TodayPage.
8. `SYNC_DONE_EVENT` → re-fetch (patrón `tick` de TodayPage), unificado en un solo lugar.
9. Rutas: `/` → `VisitsPage`; `/calendario` → `<Navigate to="/" replace />` (no rompe hábitos/links viejos).
10. Nav inferior: un solo item `{ to: '/', label: 'Visitas', icon: '📅' }` (queda: Visitas / Alertas / Perfil).
11. Empty states con CTA accionable "Programar visita →" (`/visita/nueva`) en lugar del link "Ver calendario".
12. Semántica de filtros de fecha idéntica a TodayPage: `hoy` = `fecha === todayISO()`; `semana` = `today <= fecha <= today+7`; `mes` = sin filtro client-side (el servidor ya filtra por mes).
13. Al cambiar chip/cursor: `setVisits(null)` al inicio del efecto → skeleton en cada transición (comportamiento de CalendarPage, más claro).

## Tareas

### 1. Crear `mobile/src/pages/VisitsPage.tsx`

Fusionar el código existente (copiar de las páginas actuales, no reescribir de memoria):

- **Permisos/gate**: copiar de TodayPage (si `!canOperaciones` → `EmptyState` 🔒 con link a `/perfil`).
- **Estado**:
  ```ts
  const [filter, setFilter] = useState<'hoy' | 'semana' | 'mes'>('hoy')
  const [cursor, setCursor] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() + 1 }))
  const [visits, setVisits] = useState<Visit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState(true)
  const [unread, setUnread] = useState(0)
  const [tick, setTick] = useState(0)
  ```
- **Carga** (efecto con deps `[canOperaciones, filter, cursor, tick]`, flag `cancelled` como en las actuales):
  - `hoy`/`semana`: usar `loadVisits()` de TodayPage (mes actual + siguiente si hoy+7 cruza mes).
  - `mes`: `fetchAll<Visit>('/visits', { year: cursor.year, month: cursor.month })`.
  - Arrancar con `setVisits(null)`.
- **Notificaciones no leídas**: copiar efecto de TodayPage (`GET /notifications?leida=0&per_page=1` → `meta.total`).
- **Sync**: `useEffect` con `SYNC_DONE_EVENT` → `setTick(t => t + 1)` (semántica TodayPage).
- **Memo de grupos**: combinar ambos — primero filtro de fecha según chip (regla 12), luego `activeOnly` (regla 4), luego grouping por `fecha_programada ?? 'sin-fecha'` con sort de keys (copiar de CalendarPage).
- **Render** (orden vertical):
  1. Header sticky "RedPrint Operativo" + campana con badge (de TodayPage, con `canNotif`).
  2. `<Page>` con fecha larga `formatDateLong(todayISO())`.
  3. Fila chips de período (Hoy/7 días/Mes) + `+ Visita` a la derecha (`justify-between`, de TodayPage).
  4. Si `filter === 'mes'`: fila navegador ‹ `formatMonthLabel(cursor)` › (de CalendarPage).
  5. Fila chips Activas/Todas (de CalendarPage).
  6. Error → `Banner tone="error"` + botón "Reintentar" (`setTick`) — versión de TodayPage.
  7. Skeletons (3x `SkeletonCard`) si `visits === null && !error`.
  8. Empty state por chip (textos de TodayPage: hoy/semana/mes) con CTA `<Link to="/visita/nueva">Programar visita →</Link>`.
  9. Grupos: `<section>` con header `formatDayLabel` (o "Sin fecha") + `VisitCard`.
- Componentes/UI existentes: `Banner, Chip, EmptyState, Page, SkeletonCard` de `../components/ui`; helpers `addDaysISO, formatDateLong, formatDayLabel, formatMonthLabel, nextMonth, prevMonth, todayISO` de `../lib/format`. Sin cambios en `ui.tsx` ni `format.ts`.

### 2. Actualizar rutas en `mobile/src/App.tsx`

- Quitar imports de `TodayPage` y `CalendarPage`; importar `VisitsPage`.
- `<Route index element={<VisitsPage />} />`.
- `<Route path="calendario" element={<Navigate to="/" replace />} />`.

### 3. Actualizar nav en `mobile/src/components/Layout.tsx`

- Reemplazar los dos primeros items por uno: `{ to: '/', label: 'Visitas', icon: '📅', show: hasPermission('operaciones.calendario') }`.
- `end={item.to === '/'}` ya existe y sigue válido.

### 4. Eliminar páginas viejas

- Borrar `mobile/src/pages/TodayPage.tsx` y `mobile/src/pages/CalendarPage.tsx`.

### 5. Validación

1. Lint: `docker compose run --rm --no-deps mobile sh -c "npm run lint"` (debe pasar con 0 warnings).
2. Build + typecheck: `docker compose run --rm --no-deps mobile sh -c "npm run build"` (incluye `tsc --noEmit`). **No modificar el script `build`** (vacía `dist` sin borrar la carpeta; bind mount de nginx, decisión D14 de PROJECT.md).
3. Verificación manual en `http://localhost:8080/m/` con hard refresh (Ctrl+F5), logueado como operador (contraseña `password`):
   - Al abrir la app: chip Hoy activo, filtro Activas, visitas de hoy agrupadas por día.
   - Chip 7 días: muestra próximos 7 días (incluye cruce de mes si aplica).
   - Chip Mes: aparece navegador ‹ ›, cambia el mes consultado.
   - Chip Todas: aparecen COMPLETADAS/CANCELADAS/OMITIDAS.
   - "+ Visita" → `NewVisitPage` → guardar → vuelve a `/` y la visita nueva es visible.
   - URL vieja `/m/calendario` redirige a `/m/`.
   - Campana visible con contador de no leídas (si el rol tiene notificaciones).
   - Nav inferior con 3 tabs: Visitas / Alertas / Perfil.
   - Usuario sin `operaciones.calendario`: gate 🔒 y solo tabs Alertas/Perfil.
4. No hay cambios de backend; no se requieren migraciones ni `php artisan test`.

## Fuera de alcance

- Tope de 10 páginas de `fetchAll` (deuda conocida §11.5 de PROJECT.md; comportamiento preexistente).
- Offline/PWA para navegación (deuda §10 móvil).
- Cambios en `VisitCard`, `NewVisitPage`, cola offline o backend.

## Riesgos

- **Bajo** (solo UI móvil, sin backend). El redirect de `/calendario` mantiene compatibilidad de links.
- Única pérdida funcional deliberada: nada (todas las features de ambas páginas se conservan; el único elemento retirado es el link "Ver calendario →" del empty state, reemplazado por CTA "Programar visita").
