# Plan: Sustituciones diferidas en móvil — enlace `reemplaza_a` con selector y herencia

## Problema

En móvil, `InstallationPage.tsx` solo auto-detecta el enlace `reemplaza_a` cuando el retiro
ocurrió **en la misma visita** (fuente: `cambios_impresoras`, acotada por
`datos_adicionales->visita_id` en `VisitController::show:76-81`). Si el retiro se hizo un día
y la instalación otro (visita distinta), la instalación nace **sin enlace**: se pierde la
genealogía ("Reemplaza a..." en la UI web), el alias/color no se heredan (dependen de que el
operador los teclee), y la fila liberada queda huérfana acumulándose para siempre en el select
"Sustituye a (opcional)" de la web (`ContractDetail.tsx:226`). No existe endpoint para enlazar
retroactivamente: el enlace solo puede fijarse **al asignar**.

Además hay un hueco de integridad server-side: `ContractService::assignPrinter` valida que la
fila a reemplazar sea del contrato y esté liberada, pero **no** que ya haya sido enlazada por
otra instalación — dos filas podrían apuntar a la misma `reemplaza_a` (web y móvil solo
filtran client-side; con datos stale el riesgo crece al exponer un selector manual).

El cobro **no** se ve afectado (los deltas son por ventana de asignación y se suman por
contrato; `reemplaza_a` no alimenta facturación). Este plan cierra el hueco genealógico y el
guard de integridad.

## Decisiones cerradas (con el usuario)

- **D1**: La lista de "sustituciones pendientes" en móvil incluye **todas** las asignaciones
  liberadas sin reemplazo (`activa === false && !reemplazada_por_id`), cualquier
  `motivo_liberacion` — paridad con el select web.
- **D2**: Se incluye el **endurecimiento backend** contra doble reemplazo: índice único parcial
  + validación en servicio + test.
- **D3**: Sin endpoints nuevos: el móvil reusa `GET /contracts/{id}`, cuya respuesta ya incluye
  el array `impresoras` con `activa`, `motivo_liberacion`, `reemplazada_por_id`, `alias`,
  `color` (`ContractController::show` carga `printers.maintenanceOrders/expenses` →
  `ContractResource::resolverImpresoras` se popula). La página **ya llama** a ese endpoint hoy
  (para el plan, líneas 142–157).
- **D4**: El auto-detect de misma visita se **preserva** como pre-selección por defecto (sin
  regresión del flujo actual).

## Cambios

### 1. Backend — guard anti doble reemplazo

**Migración nueva** `backend/database/migrations/2026_09_03_000000_unique_reemplaza_a_contract_printer.php`:

- `up()`:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS contract_printer_reemplaza_a_unique
      ON contract_printer (reemplaza_a) WHERE reemplaza_a IS NOT NULL
  ```
  (`down()`: `DROP INDEX IF EXISTS`). Convención del proyecto: índice parcial con
  `DB::statement`, igual que `contract_printer_contrato_impresora_active_unique` en
  `2026_09_02_000000_add_bordes_liberacion_to_contract_printer.php`. El FK existente es
  `nullOnDelete`, compatible con el índice parcial.
- Antes de migrar, verificar duplicados preexistentes (la migración fallará ruidosamente si
  los hay; DB en etapa dev/seed, se espera cero):
  ```sql
  SELECT reemplaza_a, COUNT(*) FROM contract_printer
  WHERE reemplaza_a IS NOT NULL GROUP BY reemplaza_a HAVING COUNT(*) > 1;
  ```

**`backend/app/Services/ContractService.php` — `assignPrinter`** (tras cargar `$reemplazada`,
~línea 249):

```php
if ($reemplazada !== null && ContractPrinter::where('reemplaza_a', $reemplazada->id)->exists()) {
    throw new BusinessRuleException(
        'La asignación indicada ya fue reemplazada por otra instalación'
    );
}
```

Check-then-act con el índice parcial como backstop de concurrencia (el `catch` existente de
`UniqueConstraintViolationException` lo atrapa; su mensaje genérico es aceptable para esa
ventana de carrera).

**Test** en `backend/tests/Feature/ContractPrinterReassignTest.php` (reusar helpers
`assign`/`release`/`createPrinter` existentes):

- `test_reemplaza_a_ya_enlazada_es_rechazado`: asignar A → liberar A → asignar B con
  `reemplaza_a` = fila de A (aceptado) → asignar C con `reemplaza_a` = misma fila de A →
  espera 422 con mensaje "ya fue reemplazada".

### 2. Móvil — tipos (`mobile/src/types/api.ts`)

- Nuevo `ContractAssignment` (espejo de `ContractResource::resolverImpresoras`, ids numéricos
  como llegan del backend):
  ```ts
  export interface ContractAssignment {
    id: number
    impresora_id: number
    impresora_marca: string | null
    impresora_modelo: string | null
    impresora_serie: string | null
    alias: string | null
    color: string | null
    activa: boolean
    motivo_liberacion: string | null
    reemplaza_a: number | null
    reemplazada_por_id: number | null
    fecha_liberacion: string | null
    fecha_asignacion: string | null
  }
  ```
- Extender el tipo de la respuesta de contrato que consume `InstallationPage`
  (`ContractPlanInfo` o el inline del `api.get`) con `impresoras?: ContractAssignment[]`.

### 3. Móvil — `mobile/src/pages/InstallationPage.tsx`

**Datos**: en el `useEffect` existente del contrato (líneas 142–157), guardar además
`impresoras` en un estado `assignments`. Derivar:

```ts
const pendientes = (assignments ?? []).filter(
  (pa) => pa.activa === false && !pa.reemplazada_por_id
)
```

**Selector** (patrón card-radio de `MOTIVOS` en `RemovalPage.tsx:254-267`), renderizado tras
el banner del plan y **antes** de "Impresoras en almacén", solo si `pendientes.length > 0`:

- `SectionTitle` "Puesto que reemplaza (opcional)" con hint "Deja 'Ninguna' si es un equipo
  adicional del contrato".
- Card 1: "Ninguna (asignación nueva)" → `reemplazaA = null`.
- Una card por pendiente: `PrinterColorDot` + alias (o `marca modelo`), `Serie: X`,
  `liberada {fecha_liberacion}` y label del motivo (mapa local `MOTIVOS_LABEL` con las 5
  claves de `MotivoLiberacion`).
- Card seleccionada con `!border-blue-500 ring-1 ring-blue-500` + ✓ (mismo estilo que la
  lista de impresoras).

**Pre-selección y herencia**:

- Mantener `sustitucionPendiente` (misma visita): si encuentra pendiente, setear
  `reemplazaA`, `aliasSugerido`/`alias` y `colorHeredado` como hoy, **y** validar que esa
  `assignment_id` exista en `pendientes` (coherencia visit↔contrato).
- Al elegir manualmente una pendiente: `setReemplazaA(id)`, prefill de alias solo si vacío
  (`setAlias((actual) => actual || pa.alias || '')`), `setAliasSugerido(pa.alias ?? null)`,
  `setColorHeredado(pa.color ?? null)`.
- Al elegir "Ninguna": `setReemplazaA(null)` y `setAliasSugerido(null)` (el alias tecleado se
  conserva tal cual; `colorHeredado` se limpia).

**Banner "Sustitución de equipo"** (líneas 254-263): cambiar el lookup de la serie/alias desde
`visit.cambios_impresoras` al elemento seleccionado de `pendientes` (así el banner también
cubre el caso diferido). Redacción: menciona que se heredarán alias y color del puesto.

**Fallback legacy** (rotación misma visita, líneas 112-123): mantener **solo** cuando
`pendientes.length === 0` (cuando hay selector, este reemplaza la heurística para evitar
sugerencias duplicadas/contradictorias).

**Submit**: sin cambios de contrato — ya envía `reemplaza_a: reemplazaA` (línea 191). El
servidor hereda alias/color si vienen null; el móvil sigue mandándolos explícitos
(comportamiento actual). El 422 del nuevo guard llega por el `Banner` de `submitError`
existente (`apiErrorMessage`).

**Degradación**: fallo del fetch del contrato → `assignments = []` → selector oculto; la
instalación como asignación nueva sigue posible (mismo patrón tolerante que el plan hoy,
líneas 150-153). Sin conexión: la instalación ya exige online (banner + submit disabled, sin
cambios).

### 4. Web — sin cambios

El select "Sustituye a (opcional)" ya funciona para cualquier fecha; cuando el móvil enlaza,
la fila liberada obtiene `reemplazada_por_id` y deja de aparecer en el dropdown automáticamente.

## Validación

1. Backend:
   ```powershell
   docker compose exec app php artisan migrate
   docker compose exec app php artisan test --filter ContractPrinterReassignTest
   docker compose exec app php artisan test
   ```
2. Móvil (lint + typecheck + build, `tsc --noEmit` corre dentro de build):
   ```powershell
   docker compose run --rm --no-deps mobile sh -c "npm run lint"
   docker compose run --rm --no-deps mobile sh -c "npm run build"
   ```
3. E2E manual en `http://localhost:8080/m/` (usuario operador, ver `mobile/README.md`;
   contraseñas sembradas: `password`):
   - **Diferido**: retiro con lectura de cierre (motivo SUSTITUCION_FALLA) en visita V1 →
     cerrar V1 → nueva visita V2 → Instalar → aparece selector con el puesto liberado →
     seleccionarlo (alias pre-rellenado) → confirmar → en el detalle web del contrato debe
     verse "Reemplaza a: [serie]" y alias/color heredados.
   - **Nueva sin enlace**: con pendientes listados, elegir "Ninguna" → alta como asignación
     nueva; el pendiente sigue apareciendo después.
   - **Misma visita** (regresión): retiro + instalación en la misma visita → auto-preselección
     y banner como hoy.
   - **Doble reemplazo**: intentar dos instalaciones enlazadas a la misma fila liberada →
     segunda recibe 422 accionable.
4. Tras validar, rebuild del `dist` (proactivo según AGENTS.md):
   ```powershell
   docker compose run --rm --no-deps mobile sh -c "npm run build"
   ```
   y hard refresh en `http://localhost:8080/m/`.

## Riesgos y notas

- El `catch` de `UniqueConstraintViolationException` en `assignPrinter` puede dar mensaje
  genérico si la carrera de concurrencia pisa el índice nuevo (aceptado: el pre-check cubre
  el camino normal con 422 claro).
- Duplicados preexistentes de `reemplaza_a` romperían la migración (deseado: falla visible;
  query de verificación incluida arriba).
- El peso de `GET /contracts/{id}` para móvil (carga `visits`, `invoices`,
  `maintenanceOrders`, `expenses`) es deuda pre-existente: no se agrava (la llamada ya se hace
  hoy); optimizar está fuera de alcance.
- Compatibilidad: sin cambios de rutas/permisos/config backend (no requiere
  `config:cache`); la migración corre con `php artisan migrate`.

## Fuera de alcance (explícito)

- Enlace **retroactivo** (endpoint para vincular una asignación activa ya creada con una
  liberada).
- La instalación implícita al **regularizar registros de campo**
  (`FieldRecordService` vinculación) tampoco enlaza `reemplaza_a`; mismo hueco, otra
  superficie — tratar por separado si surge.
- Optimizar/limpiar el dropdown web acumulativo (queda descongestionado de facto al enlazar
  desde móvil).
