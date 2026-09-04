# Plan: Mejoras al módulo de mantenimiento — integridad, flujo, visibilidad y limpieza

> Ejecutar por fases en orden. Backend primero (sin rebuild), luego web, luego móvil
> (rebuild de ambos dist). **Fuera de alcance (diferidos a plan propio):** C4
> preventivo por contador/scheduler, estado `EN_PROCESO`, `tecnico_id`, cola offline
> para reporte de fallas, sustitución de `foto_evidencia` base64 por storage.

## Contexto (hallazgos que motiva cada tarea)

1. **Sin UI de piezas**: hooks `useAddArticleToMaintenance`/`useRemoveArticleFromMaintenance` (`frontend/src/hooks/useMaintenanceOrders.ts:80-100`) y endpoints (`routes/api.php:90-92`) existen pero ningún componente los usa → órdenes sin piezas, stock de repuestos nunca descargado, `costo_total` = solo mano de obra.
2. **`update` sin guard**: `MaintenanceService::update` permite editar `costo_mano_obra`/`fecha` de órdenes COMPLETADAs → reescribe costo histórico tras el descargo de kardex (viola principio 4).
3. **`restorePrinterState` ciego** (`MaintenanceService.php:229-257`): orden correctiva (estado_anterior=RENTADA) + retiro posterior (impresora EN_ALMACEN) + completar/cancelar orden → impresora vuelve a RENTADA sin contrato.
4. **`addArticle` sin validar stock ni compatibilidad** (`MaintenanceService.php:53-68`): el 422 por stock insuficiente explota recién al completar, con la orden atascada.
5. **Retiro por falla desconectado del mantenimiento**: `ContractService::releasePrinter` (líneas 326-434) solo estampa `motivo_liberacion='SUSTITUCION_FALLA'` como texto; no crea orden. Solo el móvil retira (`mobile/src/pages/RemovalPage.tsx`; no hay UI web de release-printer).
6. **No se puede completar orden desde el móvil** (solo `POST /maintenance-orders` en `ReportFailurePage.tsx`).
7. **Wizard web pobre**: sin `tipo_problema`/`severidad`/foto; `per_page:100` hardcodeado; copy "estado PENDIENTE" (real: PROGRAMADA).
8. **Lista sin filtros/KPIs** pese a filtros backend (`MaintenanceOrderController::index`); sin endpoint de agregados.
9. **Reportes sin página**: endpoints `reports/maintenance/*` + hooks `useMaintenanceReports.ts` sin consumidor.
10. **Fallas CRITICAS no notifican**; patrón legacy `User::where('rol','ADMIN')` en `InventoryService.php:149` (deuda §10).
11. **Mocks/limpieza**: tab "Notas" fantasma (`MaintenanceDetail.tsx:160`), caso `en_proceso` muerto, `costo_total` recalculado en cliente, dead code `generateMaintenanceReport()`/`getPrinterMaintenanceHistory()` (`MaintenanceService.php:283,291`), asignación muerta `create()` línea 33.
12. **Sin `fecha_completado`** (solo `updated_at`) → imposible medir duración/MTTR.

## Decisiones cerradas (con el usuario)

- **Alcance**: Olas 1-4 sin C4 ni EN_PROCESO (diferidos).
- **B1**: creación de orden **transaccional server-side** — flag en `POST /contracts/{id}/release-printer`; nunca dos llamadas cliente.

## Decisiones de diseño adoptadas (vetables al revisar el plan)

- **A1**: `update` solo permitido en `PROGRAMADA` (bloqueo total en COMPLETADA/CANCELADA). Consistente con "piezas solo en PROGRAMADA".
- **A4**: **bloqueo duro** (422) al agregar pieza sin stock suficiente (contando filas ya agregadas del mismo artículo en la orden). La validación con lock en `complete` sigue siendo la fuente de verdad; la del alta es prevención UX.
- **B1 semántica de estados**: la orden nace dentro de la transacción del retiro, **después** de que release pone la impresora `EN_ALMACEN` → `MaintenanceService::create` la pasa a `EN_MANTENIMIENTO` con `estado_anterior_impresora=EN_ALMACEN`; al completar/cancelar restaura `EN_ALMACEN` (con `almacen_id` ya estampado por el retiro). Coherente: retirada por falla = en taller pendiente de reparar.
- **C2**: notificar a usuarios **activos** cuyo rol tiene permiso `inventario.mantenimiento` (`roles.es_sistema=true` OR existe fila `permission_role` con esa clave) — **no** la columna legacy `users.rol`. Se corrige `InventoryService::generateLowStockNotification` con el mismo patrón (deuda §10, misma índole, 3 líneas).
- **C3**: solo `fecha_completado` (timestamp nullable); backfill `= updated_at` para COMPLETADAs existentes. Sin `tecnico_id`, sin estados nuevos.
- **B2**: el cierre móvil requiere conexión (respeta D5), espejo del modal web.
- **B3 web v1**: añade `tipo_problema` + `severidad` (si CORRECTIVO) + foto opcional comprimida; `visita_id` queda fuera del wizard web (las órdenes web son administrativas; el vínculo a visita nace en móvil/B1).
- **Permisos**: endpoint de stats y artículos-compatibles bajo `inventario.mantenimiento`.
- **UI piezas**: visible para admin (`useIsAdmin`, patrón actual del detalle).

---

## FASE 1 — Backend (sin rebuild de dist)

### T1. Guard de estado en `update` (A1)
- `backend/app/Services/MaintenanceService.php::update`: primera línea — si `estado !== PROGRAMADA` → `BusinessRuleException('Solo se pueden editar órdenes programadas')`.
- Test nuevo `backend/tests/Feature/MaintenanceUpdateGuardTest.php`:
  - PUT sobre COMPLETADA (incluye cambio de `costo_mano_obra`) → 422 y BD sin cambios.
  - PUT sobre PROGRAMADA → 200.
  - Tomar convenciones de `MaintenanceProblemFieldsTest.php` (helpers `adminUser`, `createPrinter`, `postJson`).

### T2. `restorePrinterState` consciente del estado actual (A3)
- En `MaintenanceService::restorePrinterState`: cargar `$printer->fresh()`; lógica:
  1. Si `estado_actual !== EN_MANTENIMIENTO` (alguien la movió: liberaron/dieron de baja) → **no restaurar**; mantener estado; escribir `PrinterHistory` con `datos_adicionales = [orden_mantto_id, estado_conservado => estado_actual, restauracion_omitida => true]`.
  2. Si `estado_actual === EN_MANTENIMIENTO` y `estado_anterior === RENTADA` pero **no** existe fila `contract_printer` activa para la impresora → restaurar a `EN_ALMACEN` (conservar `almacen_id` vigente; si es null, dejar `EN_ALMACEN` sin almacén y anotarlo en `datos_adicionales`).
  3. En cualquier otro caso → restaurar `estado_anterior` como hoy.
- Tests en `MaintenanceUpdateGuardTest` o nuevo `MaintenanceRestoreStateTest.php`:
  - crear orden CORRECTIVA (desde RENTADA) → `release-printer` → `complete` → assert `EN_ALMACEN` + sin contrato activo (NO RENTADA). Repetir con `cancel`.
  - regresión: crear orden sobre RENTADA y completar sin retiro intermedio → sigue restaurando RENTADA (cubre `MaintenanceProblemFieldsTest` existente).

### T3. `addArticle` valida stock acumulado (A4)
- `MaintenanceService::addArticle`: sumar `cantidad` ya registrada en `articles_used` para ese `articulo_id` en la orden + la nueva `cantidad`; si `> article.stock_actual` → `BusinessRuleException("Stock insuficiente: disponible X, solicitado Y")`.
- Tests (`MaintenanceArticlesTest.php`, ver T7): stock insuficiente → 422; dos filas del mismo artículo que juntas exceden stock → 422 en la segunda; stock exacto → ok.

### T4. `fecha_completado` (C3)
- Migración `2026_09_04_000000_add_fecha_completado_to_maintenance_orders_table.php`: `$table->timestamp('fecha_completado')->nullable()->after('fecha_creacion')` + backfill `DB::table(...)->where('estado','COMPLETADA')->update(['fecha_completado' => DB::raw('updated_at')])`.
- `MaintenanceOrder`: fillable + cast `datetime`.
- `complete()`: estampar `now()`. `cancel()`/`delete()`: no tocar.
- `MaintenanceOrderResource`: exponer `fecha_completado`.
- Frontend types luego (Fase 2): mostrar en detalle ("Completada el …").

### T5. Notificación de fallas CRÍTICAS + fix legacy (C2)
- `MaintenanceService::create`: si `severidad === ProblemSeverity::CRITICA` → crear `Notification` por usuario (query: `User::where('activo',true)->whereHas('role', fn($q) => $q->where('es_sistema',true)->orWhereHas('permissions', fn($p) => $p->where('clave','inventario.mantenimiento')))`; relación `role()` de `User` por `rol_id`):
  - `tipo='MAINTENANCE_CRITICAL'`, `referencia_tipo='MaintenanceOrder'`, `referencia_id=$order->id`, `titulo='Falla crítica reportada'`, `mensaje="Impresora {marca} {modelo} (#{id}): {desc_problema}"`, `leida=false`. Una por usuario por orden (sin dedup extra).
- `InventoryService::generateLowStockNotification` (línea 149): reemplazar `User::where('rol','ADMIN')` por la misma query con permiso `inventario.articulos` (extraer helper privado compartido o duplicar query; preferir método estático pequeño en `Notification` o un scope en `User`: `User::withPermission('clave')`).
- Test: orden CRITICA → notificaciones solo a usuarios con permiso (crear user con rol limitado); orden MEDIA → sin notificaciones; stock bajo → notifica a user con `rol_id` real (regresión del bug legacy).

### T6. Retiro por falla crea orden transaccional (B1)
- `ContractController::releasePrinter` validación nueva:
  - `'crear_orden_mantenimiento' => 'nullable|boolean'`
  - `'desc_problema' => 'required_with:crear_orden_mantenimiento|nullable|string|max:2000'`
  - Si flag `true` y `motivo_liberacion !== 'SUSTITUCION_FALLA'` → 422 "La orden de mantenimiento solo puede crearse en retiros por falla".
- `ContractService::releasePrinter` firma nueva: `bool $crearOrdenMantenimiento = false, ?string $descProblema = null`. Inyectar `MaintenanceService` por constructor (sin ciclo: MaintenanceService → InventoryService). Dentro de la MISMA transacción, **después** del `PrinterHistory LIBERACION_CONTRATO`:
  - `$this->maintenanceService->create([...])` con: `impresora_id`, `fecha => today()`, `tipo_mantto => CORRECTIVO`, `desc_problema`, `socio_id` implícito (create lo estampa), `visita_id => $visitaId`, `estado` implícito PROGRAMADA. La impresora ya está `EN_ALMACEN` → create la pasa a `EN_MANTENIMIENTO` con `estado_anterior=EN_ALMACEN` (decisión de diseño).
  - Añadir al `datos_adicionales` de la liberación: `orden_mantto_id => $order->id` (trazabilidad bidireccional).
- Tests en `ContractPrinterReleaseReadingTest` (o nuevo `ReleaseCreatesMaintenanceTest.php`):
  - retiro con flag + SUSTITUCION_FALLA + desc → 200, existe orden CORRECTIVA con `visita_id`, `estado_anterior_impresora=EN_ALMACEN`, impresora `EN_MANTENIMIENTO` con `almacen_id` del retiro; evento `MANTENIMIENTO_INICIO` presente.
  - flag con `ROTACION` → 422, sin orden, **retiro no aplicado** (rollback).
  - sin flag → sin orden (regresión).
  - completar esa orden → impresora `EN_ALMACEN` (integra con T2).

### T7. Suite de piezas (`MaintenanceArticlesTest.php`)
- Flujo feliz: add artículo → `complete` → assert `inventory_movements` SALIDA con referencia `MaintenanceOrder/{id}` y `costo_total = mano_obra + Σ subtotales` (snapshot congelado a `costo_unitario` del alta).
- Cancel: piezas borradas, **cero** movimientos kardex.
- Stock insuficiente forzado en complete (bajar stock con ajuste tras el add) → 422, transacción revertida, sin kardex parcial.
- `removeArticle` en PROGRAMADA → fila fuera.

### T8. Endpoints de apoyo (B4/C1)
- `GET /maintenance-orders/stats` (permiso `inventario.mantenimiento`): `{abiertas, completadas_mes, costo_mes, pct_correctivas}` (correctivas / total del mes).
- `GET /printers/{printer}/compatible-articles` (permiso `inventario.mantenimiento`): artículos del pivote `article_printer_model` para el modelo de la impresora (`$printer->printerModel->articles()` o equivalente por la relación existente `modelosCompatibles` invertida), con `stock_actual` y `costo_unitario`; lo consume la UI de piezas como sugerencia.
- Rutas en `routes/api.php` dentro del grupo `inventario.mantenimiento`.
- Tests mínimos: stats cuadran con fixtures; compatible-articles respeta pivote.

### T9. Limpieza backend (D2)
- Borrar `MaintenanceService::generateMaintenanceReport()` y `getPrinterMaintenanceHistory()` (**grep antes** de usos), y la línea 33 de `create()` (`$data['estado_anterior_impresora']` muerta).

---

## FASE 2 — Frontend web (rebuild dist al final)

### T10. UI de piezas en `MaintenanceDetail.tsx` (A2)
- Tab "Artículos Usados" (reemplaza la actual de solo lectura):
  - Si `estado==='PROGRAMADA' && isAdmin`: formulario — Select de artículos con búsqueda server-side (`GET /articles?search=...&per_page=20`, patrón debounced existente), mostrar `stock_actual` y costo unitario junto a cada opción; badge "Compatible" para los que estén en `GET /printers/{id}/compatible-articles` (cargar al abrir la orden); Input cantidad ≥1; botón Agregar → `useAddArticleToMaintenance`.
  - Cada fila: botón quitar (icono trash, confirm inline) → `useRemoveArticleFromMaintenance` (solo PROGRAMADA).
  - Al agregar con error 422 (stock) → `parseApiError` inline sobre el formulario.
- Mostrar totales desde el servidor: sustituir el `reduce` local (`MaintenanceDetail.tsx:162-166`) por `costo_total` del resource; la suma de subtotales solo como desglose visual de filas.
- Mostrar `fecha_completado` cuando exista.

### T11. Wizard web rico + fixes de copy (B3)
- `CreateMaintenanceOrder.tsx`:
  - `tipo_problema` (Select con `problemTypeLabels`, opcional, visible siempre) y `severidad` (Select con `severityLabels`, opcional, solo cuando tipo=CORRECTIVO).
  - Foto opcional: input file + compresión a data URI (portar/reimplementar `compressImage` de `mobile/src/lib/photo.ts`; tope ~1MB tras compresión), preview con quitar.
  - Select de impresora con búsqueda server-side en vez de `per_page:100` fijo.
  - Copy del modal: "Creará la orden en estado **PROGRAMADA**".
  - El payload POST ya acepta los campos (StoreMaintenanceOrderRequest los permite hoy).

### T12. Filtros + KPIs en `MaintenanceList.tsx` (B4)
- Filtros plegables (patrón de otros listados) que alimentan `useServerTable`: `estado`, `tipo_mantto`, `severidad`, `tipo_problema`, `fecha_desde`, `fecha_hasta`.
- 4 KPIs arriba (Cards) desde `GET /maintenance-orders/stats`: Abiertas, Completadas del mes, Costo del mes (`formatCurrency`), % correctivas.

### T13. Página de reportes de mantenimiento (C1)
- `frontend/src/pages/inventory/maintenance/MaintenanceReports.tsx`: tabla "Impresoras problemáticas" (`useProblematicPrinters`) y buscador serie → panel de costo por impresora (`usePrinterMaintenanceCost`).
- Ruta en `App.tsx` (`/inventario/mantenimiento/reportes`) con `RequirePermission="inventario.mantenimiento"` + entrada en `config/nav.ts` (sub-item de Mantenimiento). Verificar que `NavItem.permiso` exista en `config/permisos.php` (ya existe la clave).

### T14. Limpieza UI (D1/D3)
- Eliminar tab "Notas" y `orderData.notas` del detalle.
- Eliminar caso `en_proceso` de `getEstadoIcon`.
- Agregar `fecha_completado` al tipo `MaintenanceOrder` (`types/maintenance-order.ts`).

---

## FASE 3 — Móvil (rebuild dist al final)

### T15. Retiro crea orden desde `RemovalPage.tsx` (B1 móvil)
- Cuando `motivo === 'SUSTITUCION_FALLA'`: sección "Orden de mantenimiento" con checkbox marcado por defecto "Crear orden correctiva" + textarea `desc_problema` precargada con `justificacion_sin_lectura` (editable), visible solo si el usuario tiene `inventario.mantenimiento` (`hasPermission`).
- Payload del `POST /contracts/{id}/release-printer`: añadir `crear_orden_mantenimiento` + `desc_problema` según checkbox.
- Success toast: "Impresora retirada" / "Impresora retirada y orden #N creada" (leer id si la respuesta lo expone; si no, mensaje genérico).
- Si el flag está activo pero falta permiso → no enviar flag y avisar ("se retirará sin orden de mantenimiento").

### T16. Completar orden desde el móvil (B2)
- Nueva pantalla `mobile/src/pages/CompleteMaintenancePage.tsx` (ruta `/visita/:id/mantenimiento/:ordenId/completar`): formulario espejo del modal web — `trabajo_realizado`, `costo_mano_obra`, `contador_impresora` opcional con placeholder del contador actual y validación local no-negativo; banner informativo del contador (mismo texto racional del web).
- Entrada: en `VisitDetailPage.tsx`, cards de `visit.mantenimientos` con `estado==='PROGRAMADA'` → botón "Completar" (permiso `inventario.mantenimiento`); también desde "Ya reportado en esta visita" de `ReportFailurePage`.
- Requiere conexión: banner `useOnline` igual que `ReportFailurePage` (D5).
- `types/api.ts`: `MaintenanceOrder` += `fecha_completado?`.

---

## FASE 4 — Documentación y verificación final

### T17. Actualizar `PROJECT.md`
- §6: nota de `restorePrinterState` consciente + `fecha_completado`.
- §8: nuevo ADR — "Retiro por `SUSTITUCION_FALLA` crea orden correctiva en la misma transacción (flag explícito); la impresora queda EN_MANTENIMIENTO con `estado_anterior=EN_ALMACEN`; EN_MANTENIMIENTO sigue asignada al contrato y facturando renta (decisión documentada)".
- §10: tachar/eliminar items resueltos (piezas sin UI, completar solo web, tab Notas, bug `users.rol`, reportes sin página).
- §12: evidencia de lo nuevo.

### T18. Verificación
```powershell
docker compose exec app php artisan migrate            # entrypoint también lo hace al levantar
docker compose exec app php artisan test               # suite completa (incluye 6 archivos nuevos)
docker compose run --rm --no-deps frontend sh -c "npm run build"
docker compose run --rm --no-deps mobile   sh -c "npm run build"
```
- Manual en `http://localhost:8080` (Ctrl+F5):
  1. Web: crear orden CORRECTIVA → agregar 2 piezas (una sin stock → 422 inline) → completar con contador → kardex en `/inventario/movimientos` con referencia a la orden; `costo_total` cuadra.
  2. Web: editar/completar orden COMPLETADA → 422.
  3. Móvil `/m/`: visita → reportar falla CRITICA → notificación llega a admin; retiro con SUSTITUCION_FALLA → orden creada; completar la orden desde `/m/` → impresora vuelve a EN_ALMACEN.
  4. Reportes: `/inventario/mantenimiento/reportes` con datos del seeder.
- Lint (si se pide): `docker compose run --rm --no-deps frontend sh -c "npm run lint"` (ídem mobile).

## Riesgos y mitigaciones

- **T2 (restore)**: es el cambio más fino — la lógica debe cubrir (a) nobody-moved, (b) liberada, (c) dada de baja. Tests de los 3 caminos + regresión del flujo normal.
- **T6**: `ContractService` crece — delegar todo en `MaintenanceService::create` (delgadez de controller/servicio). El rollback total del retiro cuando el flag es inválido es el comportamiento deseado (transaccional).
- **Seeder**: `MaintenanceOrderSeeder` no crea `articles_used`; el backfill de `fecha_completado` con `updated_at` es aproximado — documentado en la migración.
- **Checklist §11.2**: sin enums nuevos → no hay labels/colores por agregar; `stats` y `compatible-articles` bajo permiso existente; textos UI en español con tildes ("Artículos", "Severidad", "Crítica").

## Orden de ejecución

T1→T2→T3→T4→T5→T6→T7→T8→T9 (backend, cada tarea con sus tests) → T10→T11→T12→T13→T14 (web) → T15→T16 (móvil) → T17→T18. Las fases 2 y 3 son independientes entre sí una vez terminado el backend.
