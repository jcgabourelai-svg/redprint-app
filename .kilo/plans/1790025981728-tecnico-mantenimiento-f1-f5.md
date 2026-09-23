# Plan de implementación — Perfil técnico F1–F5 (`ideas/tecnico-mantenimiento.md`)

## Objetivo

Implementar las 5 fases del perfil técnico: analítica de mantenimiento, condición técnica de impresoras, dashboard Taller, origen de piezas y planes preventivos. Cada fase es un commit independiente y desplegable por sí sola.

## Decisiones adoptadas (resuelven §6 del documento)

1. `REQUIERE_ATENCION` **no bloquea** la asignación a contrato; solo muestra aviso en el wizard (§6.1).
2. La condición aplica a impresoras en **cualquier estado** comercial, con UX explícita (§6.2).
3. Pieza de deshuese: **costo opcional capturado al extraer, default 0**, editable después. Ingresa por `InventoryService::registerEntry` con referencia `DESHUESE` (§6.3 — decidido con el usuario).
4. `PIEZAS` es reversible **solo con cambio manual admin y motivo obligatorio**; nada automático (§6.4).
5. Taller reusa el permiso `inventario.mantenimiento`; **no se crea** permiso nuevo ni rol `tecnico` (§6.5, §6.7).
6. Preventivos: **bandeja de sugerencias** con confirmación individual y acción "crear todas"; **sin auto-creación** (§6.6).
7. Cadencia por meses y/o páginas con **"el que ocurra primero"** (§6.8).
8. Impresoras legacy (`condicion = null`): **no bloquean asignación**, se muestran como "Sin condición". No hay backfill forzado.
9. Fuera de alcance (marcado en el doc y confirmado): tóner en costos por impresora (§6.9), catálogo de fallas ampliado (§6.10), tipo de orden DESMANTELAMIENTO, calendario visual de órdenes, notificaciones automáticas de preventivos, exportación CSV, app móvil para planes.

## Prerrequisitos (antes de tocar código)

- [ ] `git pull` (main local está 3 commits atrás de origin/main: toner F1–F3 + auditoría).
- [ ] `docker compose exec app php artisan migrate` (migraciones de toner).
- [ ] Recompilar dists (`frontend` y `mobile`) para partir de una base visual actual.

---

## FASE 1 — Analítica técnica (solo lectura, 0 migraciones)

### Backend

1. **`app/Services/ReportService.php`** — nuevo método `getMaintenanceStats(array $params): array`:
   - Params validados: `fecha_desde`, `fecha_hasta` (default: mes corriente), `socio_id?`.
   - Mover ahí la lógica actual de `stats()` (4 KPIs existentes, mismos nombres de clave para no romper UI).
   - Añadir sobre `maintenance_orders` COMPLETADA en rango:
     - `por_socio`: GROUP BY `socio_id` → `{socio_id, nombre, completadas, costo_manejado}` (join `users`).
     - `por_tipo_problema`: GROUP BY `tipo_problema` (solo `tipo_mantto=CORRECTIVO`).
     - `por_tipo_mantto`: `{PREVENTIVO, CORRECTIVO}` totales.
     - `mttr_dias`: `AVG(fecha_completado - fecha_creacion)` en días, 1 decimal.
2. **`app/Services/ReportService.php`** — `getTopUsedArticles(?string $desde, ?string $hasta, ?string $tipoArticulo, int $limit = 20)`:
   - `articles_used` JOIN `articles` JOIN `maintenance_orders` (COMPLETADA, `fecha_completado` en rango) → `{articulo_id, nombre, tipo_articulo, total_cantidad, total_costo}` ORDER BY `total_costo DESC`. Filtro `tipo_articulo` (`CONSUMIBLE`|`REPARACION`).
3. **`app/Services/ReportService.php`** — `getFailureRanking(?string $desde, ?string $hasta)`:
   - CORRECTIVAs COMPLETADAs en rango, GROUP BY `tipo_problema` × `printers.printer_model_id` (join `printers` → `printer_models`) → `{tipo_problema, modelo_id, marca, modelo, total}`. Devuelve también `piezas_asociadas`: para cada `tipo_problema`, top 3 `articles` por Σsubtotal en órdenes de esa falla.
4. **`app/Http/Controllers/MaintenanceOrderController.php::stats()`** — delegar en `ReportService::getMaintenanceStats($request->all())`.
5. **`app/Http/Controllers/MaintenanceReportController.php`** — 2 métodos nuevos: `topArticles(Request)`, `failures(Request)` con validación de rango (`nullable|date`, `fecha_hasta >= fecha_desde`).
6. **`routes/api.php`** (grupo `inventario.mantenimiento`):
   - `GET reports/maintenance/top-articles`
   - `GET reports/maintenance/failures`

### Frontend

7. **`hooks/useMaintenanceReports.ts`** — añadir `useTopArticles(params)`, `useFailures(params)`; **`hooks/useMaintenanceOrders.ts`** — `useMaintenanceStats(params?)` acepta rango.
8. **`pages/inventory/maintenance/MaintenanceList.tsx`** — selectores de rango (`fecha_desde`/`fecha_hasta`, default mes corriente) que alimentan `useMaintenanceStats`.
9. **`pages/inventory/maintenance/MaintenanceReports.tsx`** — rango de fechas compartido + 2 tablas nuevas: "Piezas más usadas" (nombre, tipo, cantidad, costo total) y "Ranking de fallas" (falla × modelo, total; fila expandible con piezas asociadas). Reusar patrón `<table>` existente de la página.

### Validación F1

- [ ] `tests/Feature/MaintenanceAnalyticsTest.php`: stats default mes corriente (compatibilidad claves actuales), stats con rango custom, desglose por socio/tipo, MTTR correcto con órdenes de duración conocida, top-articles agrega cantidades/subtotales y respeta filtro tipo, failures agrupa por tipo_problema × modelo. Permisos: 403 sin `inventario.mantenimiento`.

---

## FASE 2 — Condición técnica de impresoras

### Modelo de datos

1. **`app/Enums/PrinterCondition.php`** nuevo: `OPERATIVA, REQUIERE_ATENCION, NO_OPERATIVA, PIEZAS`.
2. **Migración `2026_09_22_000001_add_condicion_to_printers_table.php`**:
   - `condicion` string nullable + index; `condicion_nota` text nullable; `condicion_actualizada_en` timestamp nullable.

### Backend

3. **`app/Models/Printer.php`** — fillable + cast `condicion => PrinterCondition`; append calculado `disponible_para_renta` = `estado === EN_ALMACEN && (condicion === null || condicion === OPERATIVA) && sin orden PROGRAMADA` (reusar relación `openMaintenanceOrder`).
4. **`app/Services/PrinterService.php`** — método `actualizarCondicion(Printer $printer, PrinterCondition $nueva, ?string $nota, string $motivo, User $user, string $origen = 'MANUAL')`:
   - Guarda `condicion`, `condicion_nota`, `condicion_actualizada_en`.
   - Escribe `PrinterHistory` con `tipo_evento = 'CONDICION_ACTUALIZADA'` y `datos_adicionales = {condicion_previa, condicion_nueva, motivo, origen}`.
   - No-op si la condición es la misma (evita ruido en historial).
5. **`app/Services/MaintenanceService.php::create`** (dentro de la transacción existente, tras crear la orden):
   - Solo si `tipo_mantto === CORRECTIVO` **y** `printer->condicion !== PIEZAS`:
     - severidad `ALTA`/`CRITICA` (o null → tratar como MEDIA) → `NO_OPERATIVA`
     - severidad `BAJA`/`MEDIA` → `REQUIERE_ATENCION`
   - Origen `'ORDEN'`, motivo referencia la orden `#id`.
6. **`app/Services/MaintenanceService.php::complete`**:
   - Nueva clave opcional `$data['queda_para_piezas']` (bool). Al completar:
     - Si `queda_para_piezas && estado final de la impresora === EN_ALMACEN` → `PIEZAS` con nota del `trabajo_realizado`; si la impresora queda RENTADA, ignorar y lanzar `BusinessRuleException` (deshuese solo en almacén).
     - Si no → `OPERATIVA` (saltar si ya es `PIEZAS`).
   - `UpdateCompleteMaintenanceOrderRequest` (o el request vigente de complete): aceptar `queda_para_piezas => nullable|boolean`.
7. **`app/Services/ContractService.php::assignPrinter`** — tras el chequeo de estado EN_ALMACEN y antes del D24:
   - `condicion === NO_OPERATIVA || PIEZAS` → `BusinessRuleException` (422) con mensaje accionable ("está no operativa / es donante de piezas").
   - `REQUIERE_ATENCION` y `null` → no bloquear.
8. **`app/Http/Controllers/PrinterController.php`** + request nuevo `UpdatePrinterConditionRequest` (`condicion in:...`, `condicion_nota nullable|string`, `motivo required|string|min:3`):
   - `PATCH printers/{printer}/condicion` (grupo `inventario.impresoras` en `routes/api.php`).
9. **Flujo de deshuese (extracción de pieza)**: `POST printers/{printer}/extract-part` (grupo `inventario.impresoras`), request `{articulo_id? , nombre_nuevo?, tipo_articulo, cantidad, costo_unitario? default 0, num_parte?}`:
   - Transacción: crea `Article` (con `origen = REFACCIONADA` — campo que llega en F4; hasta entonces sin origen) si no se pasa `articulo_id`; luego `InventoryService::registerEntry($article, $cantidad, $user, 'DESHUESE', $printer->id, "Pieza extraída de impresora #{$printer->id}")`.
   - Solo permitido si `printer->condicion === PIEZAS` (422 en caso contrario).
   - Anexa a `condicion_nota` la pieza extraída.
10. **`app/Http/Resources/PrinterResource.php`** — exponer `condicion`, `condicion_nota`, `condicion_actualizada_en`, `disponible_para_renta`.

### Frontend

11. **`pages/inventory/printers/PrinterList.tsx`** — columna/chip de condición (colores: verde/amarillo/rojo/gris; null = "—") + filtro por condición en la barra existente.
12. **`pages/inventory/printers/PrinterDetail.tsx`** — sección "Condición técnica": chip actual, nota, fecha, botón "Cambiar condición" → diálogo (condición + nota + **motivo obligatorio**). Si condición = PIEZAS: botón "Extraer pieza" → diálogo del endpoint extract-part.
13. **Wizard de contrato** (página de asignación de impresoras): banner de confirmación si la impresora seleccionada tiene `REQUIERE_ATENCION` ("se renta y se atiende en la primera visita — decisión consciente"); ocultar/deshabilitar `NO_OPERATIVA` y `PIEZAS` del listado seleccionable (el guard del backend es la red de seguridad).
14. **Móvil (`mobile/src`)** — chip de condición en catálogo de impresoras e instalación (solo lectura).

### Validación F2

- [ ] `tests/Feature/PrinterConditionTest.php`:
  - Orden correctiva ALTA/CRITICA → `NO_OPERATIVA`; BAJA/MEDIA → `REQUIERE_ATENCION` (en la misma transacción).
  - Completar orden → `OPERATIVA`; con `queda_para_piezas` + EN_ALMACEN → `PIEZAS`; `queda_para_piezas` + RENTADA → 422.
  - `assignPrinter` rechaza `NO_OPERATIVA`/`PIEZAS`; permite `REQUIERE_ATENCION` y `null`.
  - `PATCH condicion` escribe `PrinterHistory` con previa/nueva/motivo; requiere motivo (422 sin él).
  - `extract-part` exige `PIEZAS`, crea entrada `DESHUESE` en kardex con costo default 0.
  - Impresora donante (`PIEZAS`) no cambia de condición al crear/completar órdenes.

---

## FASE 3 — Dashboard "Taller"

### Backend

1. **`app/Http/Controllers/TallerController.php`** nuevo — `GET /taller/dashboard` (grupo `inventario.mantenimiento`), envuelto en `Cache::remember('taller.dashboard', now()->addMinutes(5), ...)` (patrón `DashboardController`). Respuesta:
   - `kpis`: `{no_operativas, requiere_atencion, en_taller, disponibles_renta, para_piezas, sin_condicion}` (conteos por condición; `en_taller` = `EN_MANTENIMIENTO`; `disponibles_renta` usa el append de F2).
   - `cola`: órdenes PROGRAMADA con `{orden_id, severidad, tipo_mantto, dias_desde_creacion, impresora}` ORDER BY severidad DESC (CRITICA→BAJA, null al final), `fecha_creacion` ASC, limit 20.
   - `sin_orden`: impresoras `NO_OPERATIVA` **sin** orden PROGRAMADA (prompt para crearla) — `{id, marca, modelo, codigo}`.
   - `matriz_estado_condicion`: filas por `estado` (excluye DADA_DE_BAJA), columnas por condición.
   - `piezas_bajo_umbral`: articles `tipo_articulo = REPARACION` con `stock_actual <= stock_minimo` (reusar la señal existente) — `{id, nombre, stock_actual, stock_minimo}`.
   - `productividad_mes`: delega en `ReportService::getMaintenanceStats([])` (mes corriente).

### Frontend

2. **`pages/inventory/taller/TallerDashboard.tsx`** nueva + `hooks/useTaller.ts` (`useTallerDashboard`, refetch cada 5 min):
   - Fila de KPIs (tarjetas estilo dashboard existente).
   - "Cola del taller": tabla ordenada con badge de severidad y aging (`dias_desde_creacion`), click → `MaintenanceDetail`.
   - "Sin orden": lista compacta con botón "Crear orden" → navega a `CreateMaintenanceOrder` con impresora precargada.
   - Matriz estado × condición (tabla pequeña con totales).
   - Piezas REPARACION bajo umbral.
   - Productividad del mes (completadas, MTTR, % correctivas).
3. **`config/nav.ts`** — entrada `{ id: 'taller', label: 'Taller', path: '/inventario/taller', permiso: 'inventario.mantenimiento' }` tras "Mantenimiento".
4. **`App.tsx`** — ruta `inventario/taller` con `RequirePermission permiso="inventario.mantenimiento"`.

### Validación F3

- [ ] `tests/Feature/TallerDashboardTest.php`: KPIs cuadran con fixtures (una NO_OPERATIVA con orden vs sin orden → `sin_orden`), cola ordenada por severidad y antigüedad, matriz suma totales, permiso requerido.

---

## FASE 4 — Origen de piezas

1. **`app/Enums/ArticleOrigin.php`** nuevo: `ORIGINAL, COMPATIBLE, REFACCIONADA`.
2. **Migraciones**:
   - `2026_09_22_000002_add_origen_to_articles_table.php`: `origen` string nullable (sin index).
   - `2026_09_22_000003_add_origen_snapshot_to_articles_used_table.php`: `origen_snapshot` string nullable.
3. **`app/Models/Article.php`** y **`app/Models/ArticleUsed.php`** — fillable + casts.
4. **`app/Services/MaintenanceService.php::addArticle`** — congelar `'origen_snapshot' => $article->origen?->value` junto al costo (patrón D3 existente).
5. **Requests**: `StoreArticleRequest`/`UpdateArticleRequest` (y el request que use extract-part de F2) aceptan `origen nullable|in:ORIGINAL,COMPATIBLE,REFACCIONADA`. Nullable a propósito: catálogo legacy se completa al editar.
6. **`app/Http/Resources/ArticleResource.php`** + `ArticleUsed` en `MaintenanceOrderResource` — exponer origen.
7. **`ReportService::getTopUsedArticles`** (F1) — añadir `por_origen`: GROUP BY `origen_snapshot` (Σcantidad, Σcosto por origen).
8. **Frontend**: select de origen en el formulario de artículo (con placeholder "Sin especificar"); columna "Origen" en el picker de piezas de la orden (`CreateMaintenanceOrder`/`MaintenanceDetail`) usando snapshot; en Reportes, subtabela o columna de desglose por origen en "Piezas más usadas".
9. **Móvil**: chip opcional de origen en el detalle de orden (prioridad baja).

### Validación F4

- [ ] `tests/Feature/ArticleOriginTest.php`: snapshot se congela al agregar pieza (reclasificar el artículo después no altera la orden), reporte top-articles desglosa por origen, validación 422 con origen inválido.

---

## FASE 5 — Planes preventivos y bandeja

### Modelo de datos

1. **Migración `2026_09_22_000004_create_maintenance_plans_table.php`**:
   - `id`, `printer_model_id` FK nullable → `printer_models`, `printer_id` FK nullable → `printers` (exactamente uno no-null, validado en servicio; a nivel BD check simple si PostgreSQL lo permite o validar solo en app), `activo` bool default true, `periodicidad_meses` int nullable, `periodicidad_paginas` int nullable, `ventana_aviso_dias` int default 15, `ultimo_servicio_fecha` date nullable, `ultimo_servicio_contador` int nullable, `proximo_servicio_fecha` date nullable, `proximo_servicio_contador` int nullable, timestamps. Index `(activo, proximo_servicio_fecha)`.
2. **Migración `2026_09_22_000005_add_plan_to_maintenance_orders_table.php`**: `maintenance_plan_id` FK nullable → `maintenance_plans` (trazabilidad del ciclo).

### Backend

3. **`app/Models/MaintenancePlan.php`** — relations (`printerModel`, `printer`), casts; scope `activos()`.
4. **`app/Services/MaintenancePlanService.php`** nuevo:
   - `planEfectivo(Printer $printer): ?MaintenancePlan` — plan por impresora gana sobre plan de su modelo.
   - `syncHistorico(MaintenancePlan $plan)` — al crear/activar: backfill de `ultimo_servicio_*` desde la última orden PREVENTIVO COMPLETADA de la impresora/modelo; calcula `proximo_*` (fecha = `ultimo + periodicidad_meses`; contador = `ultimo + periodicidad_paginas`; ambos si ambos definidos — "el que ocurra primero").
   - `upcoming(): Collection` — para cada impresora activa (no DADA_DE_BAJA) con plan efectivo: `{plan_id, impresora, dias_restantes|paginas_restantes, estado: VENCIDO|PROXIMO|OK}`, sin crear nada.
   - `crearOrdenDesdeSugerencia(Printer $printer, MaintenancePlan $plan, string $fecha, User $user): MaintenanceOrder` — valida que NO exista orden PROGRAMADA para la impresora (idempotencia; el guard D24 de `assignPrinter` es complementario), crea orden PREVENTIVO PROGRAMADA vía `MaintenanceService::create` con `maintenance_plan_id` seteado.
   - `recalcularTrasCompletar(MaintenanceOrder $order)` — si `tipo_mantto=PREVENTIVO` y la impresora tiene plan efectivo: `ultimo_servicio_fecha = fecha_completado`, `ultimo_servicio_contador = contador_impresora de la orden (o printers.contador_actual)`, recompute `proximo_*`.
5. **`app/Services/MaintenanceService.php::complete`** — llamar a `recalcularTrasCompletar` dentro de la transacción.
6. **Comando `maintenance:sync-plans`** (`app/Console/Commands/SyncMaintenancePlans.php`): recalcula `proximo_*` de todos los planes activos (backfill diario, idempotente). **`routes/console.php`**: `Schedule::command('maintenance:sync-plans')->dailyAt('02:15')->timezone('America/Cancun')->withoutOverlapping()` (tras visitas 02:00, antes de facturas 02:30). No crea órdenes ni notifica (decisión 6).
7. **`app/Http/Controllers/MaintenancePlanController.php`** + requests CRUD (`StoreMaintenancePlanRequest`: exactamente uno de `printer_model_id`/`printer_id`, al menos una periodicidad > 0):
   - `GET maintenance-plans` (index, con `upcoming` embebido o endpoint aparte `GET maintenance-plans/upcoming`).
   - `POST maintenance-plans/{plan}/create-order` `{impresora_id, fecha}` → bandeja (uno por uno).
   - `POST maintenance-plans/create-orders-batch` `{items: [{impresora_id, plan_id, fecha}]}` → "crear todas" (recorre `crearOrdenDesdeSugerencia`, ignora-conflictos con reporte de omitidas).
   - Grupo `inventario.mantenimiento` en `routes/api.php`.

### Frontend

8. **`pages/inventory/maintenance/MaintenancePlans.tsx`** nueva — CRUD de planes (modelo o impresora, periodicidades, ventana de aviso) + bandeja "Vencidos y próximos" (tabla con estado, días restantes, botón "Crear orden" y "Crear todas").
9. **`hooks/useMaintenancePlans.ts`** — queries/mutations con invalidación de `['maintenance-plans']` y `['maintenance-orders']` al crear.
10. **`TallerDashboard.tsx`** (F3) — sección "Preventivos" con resumen de vencidos/próximos y link a la bandeja.
11. **`App.tsx` + `config/nav.ts`** — ruta `inventario/mantenimiento/planes` bajo el permiso existente (entrada de nav solo si la bandeja se usa fuera de Taller; evaluar: preferible link desde Taller y desde Mantenimiento, sin entrada nueva de nav).
12. **`MaintenanceList.tsx`** — filtro por rango de fechas (`fecha` desde/hasta) como MVP de agenda (decisión 9: sin calendario visual).

### Validación F5

- [ ] `tests/Feature/MaintenancePlanTest.php`:
  - `planEfectivo`: override por impresora gana al de modelo.
  - Backfill correcto desde última preventiva completada.
  - `crearOrdenDesdeSugerencia` es idempotente (segunda llamada con orden PROGRAMADA existente → `BusinessRuleException`, no duplica).
  - Al completar la preventiva se recalculan `ultimo_*`/`proximo_*` en la misma transacción.
  - Cadencia doble (meses + páginas): vence con el primero que llegue.
  - `maintenance:sync-plans` corre sin duplicar (dos ejecuciones → mismo estado).
  - Batch respeta idempotencia y reporta omitidas.

---

## Orden de ejecución y commits

```
F1 (feat: analítica de mantenimiento) → F2 (feat: condición técnica) → F3 (feat: dashboard taller)
→ F4 (feat: origen de piezas) → F5 (feat: planes preventivos)
```

- Un commit por fase, estilo repo (`feat: ...`). F3 depende de F2 (usa condición y `disponible_para_renta`). F4 es independiente. F5 toca `MaintenanceService::complete` — merge después de F2 para evitar conflicto en el mismo método.
- Tras cada fase: `docker compose exec app php artisan test`; si cambió config/rutas: `php artisan config:cache`. Al terminar fases con frontend: `docker compose run --rm --no-deps frontend sh -c "npm run build"` (y `mobile` en F2) + hard refresh en `http://localhost:8080`.

## Validación global (final)

- [ ] Suite completa: `docker compose exec app php artisan test`.
- [ ] Migraciones en limpio: `docker compose exec app php artisan migrate` sin errores.
- [ ] Smoke manual en 8080: reportes con rango, semáforo en catálogo, guard del wizard, Taller, origen en picker, bandeja con "crear todas".
- [ ] Recompilar ambos dists y recargar con Ctrl+F5.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Condición desactualizada si solo es manual | Transiciones automáticas en `create`/`complete` de `MaintenanceService` (camino feliz) + chips visibles |
| Romper invariantes de asignación/facturación | Campo ortogonal; no se toca `PrinterStatus`; guard solo añade rechazos, nunca permite lo hoy prohibido |
| Órdenes preventivas fantasma | Bandeja con confirmación + idempotencia por orden PROGRAMADA existente + job sin efectos de creación |
| Kardex roto por piezas de deshuese | Único ingreso vía `InventoryService::registerEntry` (transacción + lock + kardex estándar), referencia `DESHUESE` |
| Backward compatibility de `stats()` | Defaults = mes corriente y mismas claves de respuesta; tests de regresión incluidos |
| Legacy sin condición | `null` no bloquea nada; UI "Sin condición"; sin backfill forzado |
| Bind mount de `dist` en Windows | No cambiar el script `npm run build` (vacia `dist` sin borrar la carpeta); si aparece 500 en `/`, `docker compose restart nginx` |

## Fuera de alcance (explícito)

Tóner en costo por impresora (§6.9, ligado a `niveltoner.md` F4) · catálogo de fallas ampliado (§6.10) · orden tipo DESMANTELAMIENTO · calendario visual de órdenes/visitas técnicas · notificaciones automáticas de preventivos · permiso `inventario.taller` o rol `tecnico` · exportaciones CSV/PDF · acople preventivo↔visita (`VisitType::MANTENIMIENTO`) más allá de la sugerencia manual de fecha.
