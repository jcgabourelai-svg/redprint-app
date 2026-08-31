# Plan: Visibilidad de visitas vencidas en la app móvil (`/m/`)

## Problema

La pantalla inicial de `VisitsPage` arranca con el filtro "Hoy" y solo descarga el mes actual
(`mobile/src/pages/VisitsPage.tsx:21-33,40,102`). Una visita `PENDIENTE` con fecha pasada
(vencida) es invisible: no aparece en "Hoy" y ni siquiera está en memoria si es de un mes
anterior. El estado vacío "No tienes visitas programadas para hoy" (línea 240) da la impresión
falsa de que no hay trabajo pendiente. Una visita vencida = lectura no capturada = ingreso
diferido (la lectura alimenta la facturación), así que es un problema de negocio, no cosmético.

Bloqueador de backend: `VisitController::index` (`backend/app/Http/Controllers/VisitController.php:41-58`)
solo filtra por `year`/`month` exactos. La API no puede expresar "activas con fecha < hoy" en
una query.

## Diseño elegido (patrón híbrido, ni "en todas las vistas" ni "vista aparte")

1. **Sección "⚠️ Vencidas (N)" embebida arriba del listado de "Hoy"** con las cards completas,
   ordenadas de la más antigua a la más reciente. Si hoy no hay visitas pero sí vencidas, la
   sección se muestra igual con una línea "Hoy no tienes visitas programadas" debajo.
2. **Chip "Vencidas"** como cuarto filtro (`hoy | semana | mes | vencidas`) para trabajar el
   backlog deliberadamente.
3. **Estado vacío honesto**: "No hay visitas para hoy, pero tienes N vencidas" + link
   "Ver vencidas →" (cuando hoy=0 y vencidas>0). Mensaje actual solo cuando vencidas=0.
4. **Card con tratamiento rojo** cuando la visita está vencida: badge "Vencida · hace N días"
   en lugar del badge de estado genérico.
5. La resolución (completar / reprogramar / omitir) ya existe en `VisitDetailPage` — este plan
   NO toca la máquina de estados. Solo visibilidad.

Definición operativa de **vencida**: `estado ∈ {PENDIENTE, REPROGRAMADA}` Y
`fecha_programada < hoy` (misma semántica que ya usa el toggle "Activas" en VisitsPage:104).

## Tareas

### 1. Backend — `VisitController::index` (filtros de rango y multi-estado)

En `backend/app/Http/Controllers/VisitController.php`, extendER el builder de `index()`:

- `estado` acepta lista separada por comas (retrocompatible con el valor único que envía el
  frontend web):
  ```php
  ->when($request->estado, function ($q, $e) {
      $estados = array_filter(explode(',', (string) $e));
      $q->whereIn('estado', $estados);
  })
  ```
- Rango inclusivo sobre `fecha_programada`:
  ```php
  ->when($request->desde, fn($q, $d) => $q->whereDate('fecha_programada', '>=', $d))
  ->when($request->hasta, fn($q, $h) => $q->whereDate('fecha_programada', '<=', $h))
  ```
- Mantener `year`/`month` intactos (el resto de la app sigue usándolos).

No hay rutas nuevas, no hay permiso nuevo (reutiliza `operaciones.calendario`,
`routes/api.php:121-128`, decisión D9). No toca dinero ni stock.

### 2. Móvil — `lib/format.ts`

Agregar junto a `addDaysISO` (usar `parseISODate` existente, sin dependencias nuevas):

```ts
export function diffDaysISO(fromISO: string, toISO: string): number {
  const ms = parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()
  return Math.round(ms / 86_400_000)
}

export function daysOverdueLabel(fechaISO: string): string | null {
  // null si no está vencida; 'hace N días' si sí (N >= 1)
}
```

### 3. Móvil — `components/VisitCard.tsx`

- Detectar vencida: `estado ∈ {PENDIENTE, REPROGRAMADA}` && `fecha_programada` &&
  `fecha_programada.slice(0,10) < todayISO()`.
- Si está vencida: borde izquierdo rojo (`border-l-4 border-l-red-500`) y reemplazar el badge
  de estado por `<Badge tone="red">Vencida · {daysOverdueLabel(...)}</Badge>`. Mantener badge
  de tipo e icono.

### 4. Móvil — `pages/VisitsPage.tsx`

- `Filter = 'hoy' | 'semana' | 'mes' | 'vencidas'`; agregar chip "Vencidas" al lado de
  Hoy/7 días/Mes.
- Estado nuevo `overdue: Visit[] | null`. En el `useEffect` de carga, en paralelo a la carga
  actual, pedir siempre:
  ```ts
  fetchAll<Visit>('/visits', {
    estado: 'PENDIENTE,REPROGRAMADA',
    hasta: addDaysISO(todayISO(), -1),
  })
  ```
  (una sola query gracias a los filtros nuevos; NO fetchear meses pasados en el cliente).
  Resetear a `null` al iniciar cada carga; respetar el flag `cancelled` existente.
- Sección vencidas **solo en filtro 'hoy'** y con `overdue.length > 0`: bloque encima de los
  grupos del día con encabezado rojo "⚠️ Vencidas (N)" + las `VisitCard` (orden
  ascendente por fecha, que es el orden que devuelve el servidor). Debajo de la sección, si no
  hay visitas de hoy, línea gris "Hoy no tienes visitas programadas".
- Filtro 'vencidas': listar `overdue` agrupado por día (reusar el agrupado existente pero
  alimentado por `overdue`), ocultar el toggle Activas/Todas (todas son activas por definición)
  y el navegador de meses. Skeleton con `overdue === null`; si el array llega vacío mostrar
  EmptyState "No tienes visitas vencidas 🎉".
- Ajustar lógica del EmptyState de 'hoy': cuando hoy=0 y vencidas>0, el EmptyState clásico NO
  se renderiza (la sección vencida + línea "Hoy no tienes…" ya lo cubren).
- Mientras `overdue === null` y no hay error, tratar la pantalla como cargando (skeletons)
  para no mostrar un "0 vencidas" falso durante la carga.

### 5. Rebuild y verificación

```powershell
# Lint móvil
docker compose run --rm --no-deps mobile sh -c "npm run lint"
# Tests backend (el código de controller cambia)
docker compose exec app php artisan test
# Recompilar SPA móvil
docker compose run --rm --no-deps mobile sh -c "npm run build"
```

Recargar `http://localhost:8080/m/` con Ctrl+F5. No se necesita `config:cache` (no cambian
rutas ni config).

## Validación funcional (escenario del usuario)

1. Crear/ajustar una visita `PENDIENTE` con fecha de hace 10 días (p. ej. `docker compose exec app php artisan tinker` → `Visit::latest()->first()->update(['fecha_programada' => now()->subDays(10)])`).
2. En `/m/` con filtro "Hoy": debe verse la sección "⚠️ Vencidas (1)" con la card roja
   "Vencida · hace 10 días" y la línea "Hoy no tienes visitas programadas".
3. Chip "Vencidas": lista la visita; abrir detalle → Reprogramar a hoy → vuelve al flujo
   normal (estado `REPROGRAMADA`, ya no vencida).
4. Sin vencidas y sin visitas hoy: EmptyState clásico actual.
5. Frontend web intacto: abrir el calendario de visitas del panel y verificar que los filtros
   por estado/mes siguen funcionando (retrocompatibilidad del `estado` con valor único).

## Fuera de alcance (explícito)

- **Scope por socio**: el móvil sigue viendo las visitas de todos los socios (comportamiento
  actual). Cambiarlo es una decisión de producto aparte; el contador de vencidas hereda esta
  semántica por ahora.
- **Panel web**: misma ceguera potencial en "Operaciones › Calendario", no se toca aquí.
- **Notificación diaria de vencidas** a la pestaña Alertas: posible mejora futura.
- **Tests automatizados nuevos**: no hay suite de tests de frontend móvil; en backend, si
  `php artisan test` es verde tras el cambio es suficiente para este alcance (los filtros son
  aditivos y opcionales).

## Riesgos

- `estado` multi-valor: el frontend web envía valor único → `explode` produce array de 1
  elemento, `whereIn` equivalente a `where`. Retrocompatible.
- `whereDate` sobre `fecha_programada`: funciona igual si la columna es `date` o `timestamp`.
- Definición de "hoy" client-side (`todayISO()`): ya es la convención de la pantalla (el
  agrupado actual compara strings de fecha igual); desviación de medianoche aceptada.
