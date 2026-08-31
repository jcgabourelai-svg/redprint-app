# Plan: visita de INSTALACIÓN automática desde el wizard de contrato

## Objetivo

Al crear un contrato con **instalaciones pendientes** (plan de modelos no cubierto por series asignadas), el wizard programa automáticamente una **visita de INSTALACIÓN** con fecha editable y opt-out. Reutiliza la máquina de estados existente: el operador instala desde el móvil durante esa visita y el autocierre existente (`ContractController::autoCompletarVisita`) la cierra al vincular la serie.

## Decisiones cerradas (no reabrir sin consultar)

1. **Condición (server-authoritative):** `pendientes = max(0, Σ plan_impresoras.cantidad − nº impresoras asignadas)`. Se crea la visita solo si `pendientes > 0` **y** el request no hizo opt-out.
   - Sin plan y sin series ⇒ `pendientes = 0` ⇒ **no** se crea (consistente con el badge `pendientes_instalacion` de `ContractResource::resolverPendientesInstalacion`).
   - Si `pendientes == 0`, `programar_visita_instalacion`/`fecha_visita_instalacion` se **ignoran silenciosamente** (misma filosofía que el fallback de color en `assignPrinter`: el servidor es árbitro y nunca bloquea).
2. **Payload nuevo:** `programar_visita_instalacion` (bool, default `true` = opt-out) y `fecha_visita_instalacion` (requerida si el flag es `true`; sin restricción relativa a `fecha_inicio` — instalar antes del arranque es un caso real).
3. **Datos de la visita:** `tipo_visita = INSTALACION`, `estado = PENDIENTE`, `socio_id = creado_por =` usuario creador (mismo criterio que la 1ª visita LECTURA en `generateNextCycle`; el admin reasigna socio después si aplica), `notas = 'Instalación inicial: vincular series del plan desde la app móvil.'`.
4. **Transacción:** dentro del `DB::transaction` existente de `ContractService::create`, después de las asignaciones y junto a `generateNextCycle`.
5. **La visita de LECTURA nunca es opcional** (invariante §6 PROJECT.md; el scheduler rolling la regeneraría de todos modos).

## Cambios

### 1. Backend — `backend/app/Http/Requests/StoreContractRequest.php`

Agregar reglas:

```php
'programar_visita_instalacion' => 'nullable|boolean',
'fecha_visita_instalacion' => 'required_if:programar_visita_instalacion,true|nullable|date',
```

### 2. Backend — `backend/app/Services/ContractService.php` (`create`)

Después del bucle de `$printerIds` y antes de `generateNextCycle`:

```php
$totalPlan = array_sum(array_map(fn ($r) => (int) $r['cantidad'], $planRows));
$pendientes = max(0, $totalPlan - count($printerIds));

if ($pendientes > 0 && ($data['programar_visita_instalacion'] ?? true) !== false
    && !empty($data['fecha_visita_instalacion'])) {
    Visit::create([
        'cliente_id' => $contract->cliente_id,
        'contrato_id' => $contract->id,
        'tipo_visita' => VisitType::INSTALACION,
        'fecha_programada' => Carbon::parse($data['fecha_visita_instalacion'])->startOfDay(),
        'socio_id' => $creator->id,
        'estado' => VisitStatus::PENDIENTE,
        'creado_por' => $creator->id,
        'fecha_creacion' => now(),
        'notas' => 'Instalación inicial: vincular series del plan desde la app móvil.',
    ]);
}
```

- Imports nuevos: `App\Enums\VisitStatus`, `App\Enums\VisitType`, `App\Models\Visit`, `Carbon\Carbon`.
- Hacer `unset` de las dos claves nuevas junto a los `unset` existentes (no son columnas de `contracts`).
- Sin comentarios extra en el código (regla del repo).

### 3. Frontend — `frontend/src/pages/contracts/CreateContract.tsx`

`useCreateContract` acepta `Record<string, unknown>` (hook `useContracts.ts:21`): no hay tipo que extender, solo agregar keys al payload.

a) Nuevo estado:
```tsx
const [programarVisitaInstalacion, setProgramarVisitaInstalacion] = useState(true)
const [fechaVisitaInstalacion, setFechaVisitaInstalacion] = useState('')
```
Inicializar `fechaVisitaInstalacion` con `fecha_inicio` cuando se llegue al paso 3 (o derivar el default en render/submit si está vacía).

b) Cálculo en el componente (misma fórmula que el server):
```tsx
const planTotal = getPlanRows().reduce((s, r) => s + r.cantidad, 0)
const pendientesInstalacion = Math.max(0, planTotal - selectedPrinters.length)
```

c) Paso 3 (Confirmación): si `pendientesInstalacion > 0`, card nueva (estilo de los bloques existentes, tono info/warning) con:
- `Checkbox` de `@/components/ui/Checkbox` (existe): "Programar visita de instalación" (default checked).
- `Input type="date"` para la fecha (default `fecha_inicio`), deshabilitado si el checkbox está desmarcado.
- Texto de ayuda: quedan N equipos por instalar; la visita se cierra sola al vincular las series desde la app móvil.

d) `handleCreate`: agregar al payload solo cuando `pendientesInstalacion > 0`:
```tsx
programar_visita_instalacion: programarVisitaInstalacion,
fecha_visita_instalacion: programarVisitaInstalacion ? (fechaVisitaInstalacion || fecha_inicio) : null,
```

e) Modal de confirmación: si aplica, agregar línea a los efectos: "• Programará una visita de instalación el [fecha] (pendiente instalar N equipos)". Success modal: mención análoga.

### 4. Tests — `backend/tests/Feature/ContractPlanTest.php`

Reutilizar helpers existentes (`adminUser`, `createClient`, `createModel`, `createPrinter`, `contractPayload`). Casos:

1. Plan 2× modelo, sin series, con `fecha_visita_instalacion` ⇒ visita INSTALACION PENDIENTE con esa fecha (+ la LECTURA habitual).
2. Mismo payload con `programar_visita_instalacion: false` ⇒ no existe visita INSTALACION.
3. Plan 2× + 2 series asignadas + flag true ⇒ sin visita INSTALACION (flag ignorado).
4. Flag true sin `fecha_visita_instalacion` ⇒ 422.
5. Autocierre: crear contrato con plan (visita INSTALACION generada), luego `POST /contracts/{id}/assign-printer` con `visita_id` de esa visita ⇒ visita queda COMPLETADA (ejercicio del flujo extremo a extremo).
6. Scheduler: tras crear contrato con visita INSTALACION pendiente, `VisitSchedulerService::generateRecurringVisits()` (o `generateNextCycle`) sigue creando la visita LECTURA (guards filtran por tipo LECTURA — verificar con assert de conteo por tipo).

## Interacciones verificadas (por qué no se rompe nada)

- **Scheduler rolling:** `generateNextCycle` y `generateRecurringVisits` solo cuentan/filtran `tipo_visita = LECTURA`; la visita INSTALACION no ocupa slot ni bloquea la regeneración.
- **Autocierre:** `ContractController::assignPrinter` → `autoCompletarVisita($visita, INSTALACION)` ya cierra la visita al vincular serie con `visita_id`. El móvil ya envía `visita_id` (`InstallationPage.tsx:146`). Cero cambios de móvil.
- **Finalizar/Cancelar contrato:** `cancelFutureVisits` cancela toda visita PENDIENTE del contrato, incluida la de INSTALACION. Correcto.
- **`detectClientsWithoutVisit`** (no filtra por tipo) hoy **no se usa** en ningún controller; fuera de alcance.

## Riesgos y bordes

- Fecha de instalación anterior a `fecha_inicio`: permitido deliberadamente (instalación previa al arranque).
- Si el admin asigna series desde la web **sin** vincular la visita INSTALACION, esta queda PENDIENTE y el admin la cierra con motivo o la omite. Aceptado (no automatizar: alcance mínimo).
- `fecha_programada` pasada ⇒ visita atrasada visible; no hay restricción de fecha, el date-picker del wizard mitiga errores.

## Validación

```bash
docker compose exec app php artisan test --filter=ContractPlanTest
docker compose exec app php artisan test   # suite completa
docker compose run --rm --no-deps frontend sh -c "npm run lint"   # si se pide lint
docker compose run --rm --no-deps frontend sh -c "npm run build"   # rebuild del dist (ver abajo)
```

Prueba manual en `http://localhost:8080`: wizard de contrato con solo plan de modelos ⇒ paso 4 muestra la card de visita de instalación ⇒ crear ⇒ verificar en Calendario la visita INSTALACION PENDIENTE; desde `/m/` abrir esa visita, instalar una serie, confirmar autocierre.

## Fuera de alcance

- Cambios en app móvil (no requiere).
- Auto-programar visitas de instalación para contratos ya existentes con pendientes (solo wizard/nuevos).
- Selección de socio específico para la visita de instalación en el wizard.
- Migraciones (no hay cambio de schema).
