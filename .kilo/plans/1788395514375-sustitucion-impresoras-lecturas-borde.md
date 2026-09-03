# Plan: Sustitución de impresoras — lecturas de borde y facturación por ventana

## Problema

Hoy una sustitución de impresora a mitad de periodo provoca **fugas de facturación** y no deja rastro de la sustitución:

- **P1** — `ContractService::releasePrinter` no captura `lectura_final`: el delta "última lectura facturada → retiro" se pierde (backend/app/Services/ContractService.php:263).
- **P2** — `InvoiceCalculationService` selecciona lecturas solo de `activePrinters` (backend/app/Services/InvoiceCalculationService.php:77): aunque exista lectura de cierre, al retirar antes de facturar queda excluida para siempre.
- **P3** — No hay enlace entre la asignación liberada y su reemplazo (el "puesto"/slot no existe como concepto; alias/color se heredan solo como sugerencia de UI vía `printer_histories`).
- **P4** — `ReadingService::getPreviousReading` calcula el baseline por (impresora, contrato) y no por asignación: al re-igresar una impresora, las páginas de taller/pruebas se facturan. Además el unique total `(contrato_id, impresora_id)` (migration 0001_01_01_000007) **impide** re-asignar la misma impresora al mismo contrato.
- **P5** — `printers.contador_actual` no se sincroniza en taller/retiro y la anomalía solo se detecta con delta negativo (ReadingService.php:37).

## Decisiones tomadas (con el usuario)

1. **Retiro sin lectura** (impresora muerta): `lectura_final` opcional; si se omite → `justificacion_sin_lectura` obligatoria, brecha registrada y advertencia en el cálculo de facturación.
2. **Estructura**: un plan, **2 fases** ejecutables en orden. Fase 1 = fugas de facturación (backend). Fase 2 = semántica de sustitución + UX + sincronización de contador en taller.
3. **Umbral de anomalía positiva**: advertencia/justificación si delta > `max(2 × mayor delta histórico del contrato, 5000)`, solo cuando el contrato tiene ≥3 lecturas previas (historial suficiente).

**Regla rectora**: no se transfieren contadores entre máquinas. Cada ventana de asignación tiene lecturas de borde (apertura=cierre del anterior no aplica; apertura=`lectura_inicial`, cierre=`lectura_final`), y la factura del periodo suma los deltas de todas las ventanas que lo intersectan.

---

## FASE 1 — Cerrar fugas de facturación (backend)

### 1.1 Migración `add_bordes_liberacion_to_contract_printer`

Una sola migración sobre `contract_printer` (columnas de Fase 1 y 2 juntas para no duplicar migraciones):

- `lectura_final` unsignedInteger nullable
- `fecha_lectura_final` date nullable
- `motivo_liberacion` varchar(30) nullable (valores: `SUSTITUCION_FALLA`, `FIN_CONTRATO`, `CANCELACION_CONTRATO`, `ROTACION`, `OTRO`)
- `justificacion_sin_lectura` text nullable
- `reemplaza_a` foreignId nullable → `contract_printer.id` nullOnDelete (se usa en Fase 2)
- **Unique parcial**: drop del constraint total `contract_printer_contrato_id_impresora_id_unique` y crear índice parcial `CREATE UNIQUE INDEX contract_printer_contrato_impresora_active_unique ON contract_printer (contrato_id, impresora_id) WHERE activa` (mismo patrón que `contract_printer_alias_active_unique`, migration 2026_08_28_000001).

Actualizar `ContractPrinter` (fillable/casts) y relaciones `reemplazaA()` / `reemplazadaPor()`.

### 1.2 Retiro con lectura de cierre — `ContractService::releasePrinter`

Nueva firma: `releasePrinter(Contract $contract, Printer $printer, int $warehouseId, User $user, ?int $visitaId, ?int $lecturaFinal, ?string $motivoLiberacion, ?string $justificacionSinLectura)`.

- **Localizar la fila activa por id** (`ContractPrinter::where(...)->where('activa', true)->first()`), NO `updateExistingPivot` (con el unique parcial puede haber varias filas históricas de la misma impresora y `updateExistingPivot` re-estamparía `fecha_liberacion` en filas viejas).
- Con `lecturaFinal`:
  - Validar `>= última lectura` del (impresora, contrato): menor → `BusinessRuleException` 422 (typo del operador, no anomalía).
  - Crear `Reading` de cierre en la misma transacción: `contrato_id`, `impresora_id`, `visita_id` (si hay), `fecha = today`, `valor_contador = lecturaFinal`, `paginas_periodo = lecturaFinal − previousReading` (vía `ReadingService::getPreviousReading` ya actualizado en 1.3), `socio_id`/`creado_por` = user. → El pipeline de facturación actual la factura sin cambios adicionales.
  - Estampar `lectura_final` + `fecha_lectura_final` en el pivot y **actualizar `printers.contador_actual`**.
- Sin `lecturaFinal`: exigir `justificacionSinLectura` (validación en controller), guardarla en el pivot; `PrinterHistory::datos_adicionales` incluye `justificacion_sin_lectura`.
- `motivo_liberacion` requerido en el endpoint individual.
- `finish()`/`cancel()` (ContractService.php:112,131): llaman `releasePrinter` por impresora sin captura — registrar automáticamente `motivo_liberacion = FIN_CONTRATO|CANCELACION_CONTRATO` y `justificacion_sin_lectura = 'Liberación por finalización/cancelación de contrato'` (brecha visible; capturar lecturas al finalizar queda como mejora futura, fuera de alcance).

**Endpoint** `ContractController::releasePrinter` (ContractController.php:163): validar `lectura_final` (nullable integer min:0), `motivo_liberacion` (required, Rule::in…), `justificacion_sin_lectura` (required_if:lectura_final,null).

### 1.3 Baseline por asignación — `ReadingService::getPreviousReading`

- Buscar el pivot **activo** del (impresora, contrato); previous = última `Reading` del par con `fecha >= pivot.fecha_asignacion` (orden `fecha desc, id desc`); fallback `pivot.lectura_inicial`.
- Efecto: lecturas de asignaciones anteriores quedan excluidas del baseline → las páginas de taller de un re-ingreso no se facturan (P4). Para contratos sin sustituciones el comportamiento es idéntico al actual (regresión nula esperada).

### 1.4 Motor de facturación por ventana — `InvoiceCalculationService`

- Reemplazar `$idsImpresoras = $contratos->flatMap->activePrinters` (línea 77) por: pivots del contrato cuya ventana `[fecha_asignacion, fecha_liberacion ?? ∞]` **intersecta** `[periodoInicio, periodoFin]` (`fecha_asignacion <= periodo_fin AND (fecha_liberacion IS NULL OR fecha_liberacion >= periodo_inicio)`). La query de lecturas NO se filtra por ventana (una lectura antigua no facturada de una ventana vieja debe seguir entrando; su `paginas_periodo` ya está congelado correctamente).
- Advertencias nuevas (no bloqueantes, al array `advertencias`):
  - Por cada ventana liberada **sin `lectura_final`** que intersecte el periodo: "La impresora X fue liberada del contrato Y sin lectura de cierre; las páginas desde su última lectura no se facturan."
- `ContractResource::printerAssignmentToArray` (ContractResource.php:140): para filas liberadas, `paginas_del_periodo` usa `lectura_final ?? contador_actual` (hoy usa `contador_actual`, que tras el retiro puede seguir creciendo en taller).
- `ContractBillingService` hereda el fix (usa `calcularEstimacion`).

### 1.5 Umbral de anomalía positiva — `ReadingService::captureReading`

- Tras calcular delta: negativo → anomalía (como hoy). Positivo y contrato con ≥3 lecturas previas y delta > `max(2 × max(paginas_periodo histórico del contrato), 5000)` → exigir `justificacion_anomalia` y marcar `es_anomalia = true`.
- Exponer helper `umbralAnomalia(int $contratoId): ?int` y sumarlo al payload de captura móvil (`VisitResource` impusoras, junto a `lectura_anterior`, VisitResource.php:74) para preview client-side.

### 1.6 Tests Fase 1 (`docker compose exec app php artisan test`)

- **Nuevo** `ContractPrinterReleaseReadingTest`:
  - Retiro con lectura: crea Reading de cierre (delta correcto), estampa pivot, actualiza `contador_actual`, y **la factura generada después del retiro incluye esa lectura** (regresión clave de P2).
  - Retiro sin lectura sin justificación → 422; con justificación → 200 y advertencia presente en `calcularEstimacion`.
  - `lectura_final < última lectura` → 422.
  - `finish`/`cancel` estamplan motivo/justificación automáticos.
- **Nuevo** `ContractPrinterReassignTest`: re-asignar la misma impresora al mismo contrato crea segunda fila (unique parcial); doble asignación activa sigue bloqueada; baseline por asignación (lectura inicial nueva excluye páginas de taller).
- **Extend** `InvoiceCalculationTest`: retiro a mitad de periodo con cierre → la factura suma deltas de ambas impresoras; sin cierre → advertencia de brecha.
- **Nuevo** `ReadingAnomalyThresholdTest`: delta gigante con historial → exige justificación; con <3 lecturas → pasa.
- **Update** payloads de `ContractPrinterAliasTest`, `ContractPrinterColorTest`, `VisitCompletionTest` (ahora requieren `motivo_liberacion`).

---

## FASE 2 — Semántica de sustitución + UX + contador en taller

### 2.1 Enlace `reemplaza_a` — `ContractService::assignPrinter`

- Nuevo parámetro `?int $reemplazaA = null` (id de pivot). Validar: pertenece al mismo contrato, `activa = false`.
- Al setearlo: heredar `alias` y `color` de la fila reemplazada salvo valores explícitos (herencia determinística server-side, reemplaza la sugerencia best-effort de UI).
- `ContractController::assignPrinter`: validar `reemplaza_a` nullable exists.
- `VisitResource::cambios_impresoras` (VisitResource.php:33): agregar `assignment_id` (pivot id), `motivo_liberacion` y `lectura_final` para que la móvil ofrezca el prefill.

### 2.2 Móvil (`mobile/src`)

- `RemovalPage.tsx`: input "Contador al retirar" (numérico, con preview del delta vs `lectura_anterior` y warn si negativo), checkbox "No se puede leer el contador" que habilita textarea de justificación obligatoria, selector de motivo (default `SUSTITUCION_FALLA`). Enviar `lectura_final`, `motivo_liberacion`, `justificacion_sin_lectura`.
- `InstallationPage.tsx`: si `visit.cambios_impresoras` tiene `LIBERACION_CONTRATO` con `motivo_liberacion = SUSTITUCION_FALLA` sin `ASIGNACION_CONTRATO` posterior para ese alias → banner "Sustituye a SERIE (alias)" + prefill de `alias`, `color` y campo oculto `reemplaza_a`; lectura inicial ya se pre-llena con `contador_actual` (línea 170, ahora confiable por 1.2/2.4).
- `CaptureReadingPage.tsx`: warning suave cuando delta > `umbral_anomalia` (nuevo campo del payload), indicando que se pedirá justificación.

### 2.3 Web (`frontend/src`)

- `ContractDetail.tsx` modal "Liberar impresora" (~línea 1175): mismos campos que la móvil (contador + toggle sin lectura + justificación + motivo).
- Modal/inline de asignación: campo opcional "Sustituye a" (select de asignaciones liberadas del contrato) y prefill de alias/color.
- Lista de impresoras del contrato: en filas liberadas mostrar `motivo_liberacion`, `lectura_final` y enlace "reemplazada por X" / "reemplaza a Y" (datos ya presentes en `ContractResource`; agregar campos nuevos al resource: `motivo_liberacion`, `lectura_final`, `reemplaza_a`, `reemplazada_por_id`).
- `frontend/src/types/contract.ts`: extender tipos.

### 2.4 Contador en taller — `MaintenanceService::complete`

- `MaintenanceOrderController::complete` (línea 83): validar `contador_impresora` nullable integer min:0; si viene: debe ser `>= printers.contador_actual` (422 si menor) → `update(['contador_actual' => …])` + `PrinterHistory` evento `ACTUALIZACION_CONTADOR` con `datos_adicionales = {origen: 'MANTENIMIENTO', orden_id}`.
- UI web de completar OT: campo opcional "Contador al terminar" (frontend mantenimientos).

### 2.5 Tests Fase 2

- `reemplaza_a` inválido (otro contrato / fila activa) → 422; válido → hereda alias/color y estampa enlace.
- `MaintenanceService`: completar OT con contador lo actualiza + historial; contador menor → 422.
- E2E manual del escenario completo (ver Validación).

---

## Rollout / ejecución

1. Backend: migración + código (todo en Docker: `docker compose exec app php artisan migrate`).
2. Tests: `docker compose exec app php artisan test` (filtros: `ContractPrinterReleaseReadingTest|ContractPrinterReassignTest|InvoiceCalculationTest|ReadingAnomalyThresholdTest|ContractPrinterAliasTest|ContractPrinterColorTest|VisitCompletionTest`).
3. Recompilar SPA y móvil: `docker compose run --rm --no-deps frontend sh -c "npm run build"` e ídem `mobile`. Recargar `http://localhost:8080` con Ctrl+F5.
4. **Sin backfill** histórico: columnas nullable; brechas pasadas quedan como están (aparecen como advertencia en cálculos futuros que toquen esos periodos).

## Riesgos

- **`updateExistingPivot` multi-fila**: resuelto seleccionando la fila activa por id (1.2). Cubierto por test.
- **Cambio de baseline (1.3)**: para contratos sin sustituciones no cambia nada; edge teórico lectura capturada el mismo día anterior a `fecha_asignacion` (irrelevante en la práctica).
- **Motor por ventana (1.4)**: facturas pendientes de periodos con sustituciones pueden subir de monto (correcto, pero visible para el usuario de negocio — avisar).
- **Swap de unique en producción**: tabla pequeña, `migrate` directo; sin ventana especial.
- **`motivo_liberacion` requerido** rompe payloads antiguos: se actualizan tests; la app móvil se recompila en el mismo deploy (retiro es online-only, no hay cola offline involucrada).

## Validación manual (escenario del usuario, end-to-end)

1. Contrato 1 con impresora A → capturar lecturas → facturar mes 1.
2. Mes 2: A falla → visita de retiro capturando contador de cierre → instalar B con "Sustituye a A" (alias heredado).
3. Facturar mes 2: incluye delta de cierre de A + lecturas de B (verificar `invoice_details` con `lectura_id` de ambos).
4. A → OT completada con contador de taller (con páginas de pruebas) → re-asignar A al mismo contrato → primera lectura: delta solo desde la nueva `lectura_inicial` (sin páginas de taller).
5. Retirar sin poder leer contador → exige justificación → facturar periodo muestra advertencia de brecha.

## Fuera de alcance (follow-ups)

- Foto de evidencia en retiro; cola offline para retiro/instalación.
- Prorrateo de `tarifa_base`/`paginas_incluidas` por días cuando hay sustitución a mitad de periodo.
- Captura de lecturas finales en `finish`/`cancel` de contrato (hoy solo motivo+justificación automáticos).
- Reporte dedicado de brechas históricas (solo advertencias en el cálculo).
