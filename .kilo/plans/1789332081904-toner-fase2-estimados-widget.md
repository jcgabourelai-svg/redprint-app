# Plan: TonerService (Fase 2 — estimados) + widget "tóner bajo" del dashboard (Fase 3)

> Origen: `ideas/niveltoner.md` Fases 2 y 3-restante. Fase 1 (captura + `es_color` + alerta
> TONER_LOW) ya está implementada (commit `267cad8`, 2026-09-12).
> Alcance: servicio de estimados, exposición API (panel + detalle de impresora), widget web,
> tests. **Sin migraciones** (todo el dato ya existe en `readings.niveles_toner`,
> `article_deliveries`, `visits`).
> Fuera de alcance: Fase 4 (costo por página real — requiere ciclos de reset reales acumulados),
> cambios en móvil (la alerta TONER_LOW ya aterriza en el tab Alertas), atribución de entregas
> por impresora (`article_deliveries.impresora_id`), notificaciones nuevas.

## Decisiones cerradas (no reabrir durante la implementación)

1. **D1 intacto**: nada de esto toca `InvoiceCalculationService`, `ProfitabilityService`, ni
   ninguna respuesta de facturación. El tóner es estimativo/informativo, jamás cobro.
2. **Todo devuelve `null` con datos insuficientes** (nunca inventar) y toda la UI lo etiqueta
   "estimado". `rendimientoReal` usa **mediana**, no promedio (outliers de captura a ojo).
3. **Umbral de cambio detectado (reset)**: subida de **≥30 puntos** entre lecturas consecutivas
   del mismo color (decisión §6.6 del doc; constante `TonerService::UMBRAL_CAMBIO = 30`).
4. **Criterio de inclusión del panel**: impresoras `RENTADA` cuyo último nivel capturado tenga
   mínimo ≤ `TonerAlertService::UMBRAL` (15, reutilizado) **o** días-para-agotarse ≤ 14
   (`TonerService::DIAS_URGENCIA = 14`). Orden: días asc (nulls al final), luego nivel asc.
5. **Pendiente por color**: se calcula por color (`k/c/m/y`) entre las dos últimas lecturas
   *con ese color*; el color crítico es el de menor nivel. Flota mayormente mono ⇒ K manda.
6. **Promedio diario del contrato**: ventana de **90 días** (constante `VENTANA_PROMEDIO_DIAS`);
   si el contrato tiene lecturas pero la ventana queda corta, se usa toda la vida del contrato;
   sin contrato activo ⇒ `dias` = null (las páginas restantes sí se reportan).
7. **Lecturas consideradas**: de la impresora (`impresora_id`), orden `fecha asc, id asc`
   (mismo criterio anti-duplicado que `getPreviousReading`); pares con `Δcontador <= 0`
   (anomalía) o `Δnivel <= 0` (sin caída, pendiente incalculable) se descartan ⇒ null.
8. **Rutas nuevas**:
   - `GET /toner/panel` → middleware `permission:operaciones.lecturas` (mismos destinatarios
     que la alerta TONER_LOW).
   - `GET /printers/{printer}/toner` → dentro del grupo `permission:inventario.impresoras`
     existente (junto a `printers/{printer}/history`).
   El dashboard NO se toca en backend: el widget hace fetch propio solo si el usuario tiene
   el permiso (los widgets ya se filtran en UI, comentario en `routes/api.php:46`).
9. `cambiosDetectados` correlaciona cada reset con la entrega de TONER (`article.subtipo =
   'TONER'`) más cercana ±7 días en contratos de la impresora; sin entrega ⇒ flag
   `con_entrega: false` (señal "anomalía de insumo", informativa, nunca 422).

## Contexto clave verificado en el código

- `Reading::$fillable` incluye `niveles_toner` (cast array); columnas: `valor_contador`,
  `paginas_periodo`, `fecha`, `contrato_id`, `socio_id` (Reading.php:12-42).
- `Printer::currentAssignment()` → pivot activo con `contract.client` (Printer.php:130-135);
  `assignments()` para alias (lo usa `TonerAlertService::construirMensaje`).
- `Printer::latestReading` usa `latestOfMany('fecha')` — para el servicio se consulta
  explícitamente con `orderBy('fecha')->orderBy('id')` (tolera duplicados).
- `Visit`: estados abiertos `PENDIENTE`/`REPROGRAMADA` (VisitStatus.php), campo
  `fecha_programada` (date), `contrato_id`, `socio_id`.
- `ArticleDelivery`: `contrato_id`, `visita_id`, `fecha_creacion`, relación `article`
  (ArticleDelivery.php:8-33); `Article` tiene `subtipo` (Article.php:20).
- `TonerAlertService` ya existe con `UMBRAL = 15` y `TonerLevels::CLAVES = ['k','c','m','y']`
  (Support/TonerLevels.php:14). Reutilizar ambos, no duplicar constantes.
- Dashboard frontend (`frontend/src/pages/dashboard/Dashboard.tsx`): patrón de widgets
  `PendingTasksList`/`AlertCard` filtrados por `useTienePermiso`; hook `useDashboard`
  (react-query, `api.get('/dashboard')`).
- Detalle de impresora: `PrinterController::show` carga `readings` (limit 50) y usa
  `PrinterDetailResource`; la pestaña lecturas ya muestra `TonerLevelsChips`.
- Tests patrón: `TonerLevelTest` (helpers `adminUser`, `userWithPermissions`,
  `setupContractWithPrinter` — reutilizar el estilo, crear datos con Eloquent directo).
- Sin scheduler: el panel se computa on-demand en cada GET (flota de decenas ⇒ OK).
- BD: PostgreSQL. Entorno: todo en Docker, puerto 8080 (AGENTS.md).

---

## Tareas

### Bloque 1 — `App\Services\TonerService` (nuevo, ~backend puro)

1. Crear `backend/app/Services/TonerService.php` con constantes:
   `UMBRAL_CAMBIO = 30`, `DIAS_URGENCIA = 14`, `VENTANA_PROMEDIO_DIAS = 90`,
   `CORRELACION_DIAS = 7`, `PANEL_LIMITE = 10`.
2. **Consultas base** (privadas, reutilizadas por todos los métodos):
   - `lecturasConNivel(Printer $p): Collection` — `Reading::where('impresora_id',
     $p->id)->whereNotNull('niveles_toner')->orderBy('fecha')->orderBy('id')->get()`.
3. **`paginasRestantes(Printer $p): array<string,?int>`** — por color: localizar las dos
   últimas lecturas con ese color (`rPrev`, `rLast`); `Δpágs = rLast.valor_contador -
   rPrev.valor_contador`, `Δnivel = nivelPrev - nivelLast`; válido si `Δpágs > 0 && Δnivel > 0`;
   pendiente = `Δpágs / Δnivel`; resultado = `floor(nivelLast × pendiente)`. Si no: `null`.
4. **`diasParaAgotarse(Printer $p): array<string,?int>`** — solo si hay `paginasRestantes`
   del color y `currentAssignment->contract` existe: `promedioDiario = Σ paginas_periodo` de
   lecturas del contrato en `[today()-90d, today]` (fallback: toda la vida si la ventana trae
   <2 lecturas y la vida sí) ÷ `max(1, días entre primera y última lectura del rango)`;
   `dias = floor(paginasRestantes / promedioDiario)`; `promedioDiario <= 0` ⇒ null.
5. **`cambiosDetectados(Printer $p, int $limite = 20): array`** — iterar pares consecutivos de
   `lecturasConNivel`; por color, si `nivelPost - nivelPrev >= UMBRAL_CAMBIO` ⇒ evento:
   `{color, fecha (fecha de rPost), nivel_antes, nivel_despues, contador}`. Correlación:
   entregas `subtipo='TONER'` de contratos de la impresora con `fecha_creacion` en
   `[fecha-7d, fecha+7d]` ⇒ `con_entrega`, `entrega_fecha`, `entrega_articulo` (nombre del
   artículo). Ordenar por fecha desc, limitar.
6. **`rendimientoReal(int $printerModelId, ?int $articuloId = null): ?int`** — para cada
   impresora del modelo: sobre `lecturasConNivel` construir tramos `[reset N … última lectura
   antes del reset N+1]` (el primer tramo empieza en la primera lectura con nivel);
   `páginas = contadorFin - contadorInicio` (descartar tramos con Δ ≤ 0). Si `$articuloId`:
   solo tramos cuyo reset correlacione con entrega de ese artículo. **Mediana** de todos los
   tramos (≥1); si no hay tramos ⇒ null.
7. **`estimados(Printer $p): array`** — agregado para la API:
   `{niveles_actuales, fecha_ultimo_nivel, por_color: {k: {paginas_restantes, dias}, …},
   color_critico, nivel_critico, rendimiento_real_modelo}`.
8. **`panelBajo(): array`** — impresoras `RENTADA` con `currentAssignment.contract.client`
   cargado; para cada una con último nivel capturado: calcular niveles/estimados (métodos
   arriba, reusando la misma colección de lecturas por impresora), incluir si cumple
   decisión 4; cruzar próxima visita: `Visit` del contrato con `estado IN
   (PENDIENTE, REPROGRAMADA)` y `fecha_programada >= today`, la más próxima (una sola query
   agrupada por contrato para todas las impresoras del panel). Item:
   `{impresora_id, codigo_negocio, marca, modelo, alias, cliente_id, cliente_nombre,
   contrato_id, niveles, color_critico, nivel_critico, paginas_restantes,
   dias_para_agotarse, proxima_visita_fecha, proxima_visita_socio_nombre,
   urgente_antes_de_visita (dias !== null && dias < días-hasta-visita), fecha_ultimo_nivel}`.
   Orden decisión 4, límite 10.
   - Queries en lote (una de lecturas con nivel por las impresoras candidatas — o filtrar
     primero por `latestReading` con nivel ≤ umbral para acotar antes de estimar), no N+1
     por método.

### Bloque 2 — API

9. `backend/app/Http/Controllers/TonerController.php` (nuevo, delgado):
   - `panel()` → `response()->json(['impresoras' => $this->tonerService->panelBajo()])`.
   - `printer(Printer $printer)` → `estimados()` + `'cambios' => cambiosDetectados($printer, 10)`.
10. `routes/api.php`:
    - Dentro del grupo `permission:operaciones.lecturas` (línea ~138):
      `Route::get('toner/panel', [TonerController::class, 'panel']);`
    - Dentro del grupo `permission:inventario.impresoras` (línea ~58, junto a `history`):
      `Route::get('printers/{printer}/toner', [TonerController::class, 'printer']);`
    - No hay permiso nuevo ni migración de permisos.

### Bloque 3 — Tests backend (`docker compose exec app php artisan test`)

11. **`backend/tests/Feature/TonerServiceTest.php`** (estilo TonerLevelTest: RefreshDatabase,
    helpers propios o traits). Casos:
    - `paginasRestantes` null con 0 ó 1 lectura con nivel; y correcto con 2:
      80%@10.000 → 60%@10.500 ⇒ K = 1.500.
    - `paginasRestantes` null cuando el nivel no baja (80→80) o Δcontador ≤ 0.
    - Color parcial: K estimable, C/M/Y null cuando nunca se capturaron.
    - `diasParaAgotarse`: con lecturas del contrato en 90 días (ej. 3.000 págs en 30 días ⇒
      100/día ⇒ 1.500 págs ≈ 15 días); null sin contrato activo; null con promedio 0.
    - `cambiosDetectados`: 8%→100% = evento; 30%→35% NO es evento; evento correlacionado con
      entrega TONER a ±7 días (`con_entrega: true`); evento sin entrega ⇒ `con_entrega: false`.
    - `rendimientoReal`: dos tramos (10.000→12.900 y 13.000→15.100) ⇒ mediana ~2.950-3.000;
      con un tramo outlier (10.000→1.000.000) la mediana NO se dispara como lo haría el
      promedio (usar 3 tramos: 2.900 / 3.000 / 1.000.000 ⇒ mediana 3.000).
    - Regularización: estimados funcionan igual con lecturas nacidas de field records
      (opcional si barato; el passthrough ya está testeado en Fase 1).
12. **`backend/tests/Feature/TonerPanelTest.php`** (HTTP):
    - 401 sin sesión; 403 con usuario sin `operaciones.lecturas` (usar `userWithPermissions([])`);
      200 con el permiso.
    - Impresora con último nivel 10% aparece; con 40% y sin estimados no aparece; con 40% y
      estimado 10 días sí aparece (decisión 4).
    - Orden: días 3 antes que días 12; sin estimados al final.
    - Cruce con visita: `urgente_antes_de_visita = dias_para_agotarse < días-hasta-visita`.
      Caso A: estimado 10 días, visita PENDIENTE en 5 días ⇒ false (alcanza con llevarlo
      en esa visita). Caso B: estimado 3 días, visita en 5 días ⇒ true (se agota antes).
    - Excluye `EN_ALMACEN`/`DADA_DE_BAJA` y lecturas de impresoras de otro contrato.
13. **`TonerPrinterEndpointTest`** (puede vivir en el mismo archivo del panel):
    - `GET /printers/{id}/toner` 200 con shape de `estimados` + `cambios`; 403 sin
      `inventario.impresoras`.

### Bloque 4 — Frontend web

14. **Tipos** (`frontend/src/types/api.ts`): `TonerPanelItem` y `TonerEstimados` espejo de los
    shapes del backend (campos nullable donde aplique).
15. **Hooks** (`frontend/src/hooks/`):
    - `useTonerPanel()` → `useQuery(['toner','panel'], api.get('/toner/panel'))`.
    - `usePrinterToner(printerId)` → `useQuery(['toner','printer',id], …)`.
16. **Widget dashboard** — `frontend/src/components/dashboard/TonerBajoWidget.tsx` (nuevo):
    - Lista estilo `PendingTasksList`: identidad de impresora (`marca modelo (alias)`) +
      cliente, chips `TonerLevelsChips` con niveles, texto `~N días` o `N% sin estimado`,
      y línea de visita: "Visita: 20-sep — llevá tóner" / "Se agota antes de la visita" (rojo).
    - Estado vacío: "Sin impresoras con tóner bajo". Título con sufijo "(estimado)".
    - Click en item → `navigate('/inventario/impresoras/' + impresora_id)` (verificar ruta
      real del detalle en el router).
    - En `Dashboard.tsx`: renderizar gated por `tieneLecturas` (ya existe la variable), en
      fila propia después de row4; sumar a la condición de fila. `showRow` correspondiente.
17. **Detalle de impresora** (`frontend/src/pages/inventory/printers/PrinterDetail.tsx`):
    - Card "Tóner (estimado)" con `usePrinterToner`: niveles actuales (chips), por color
      "~1.500 páginas / ~15 días" (o "Sin datos suficientes"), último cambio detectado con
      fecha y correlación de entrega, y "Rendimiento real del modelo: N páginas (mediana)".
    - Degrada limpio con todo-null ("Capturá niveles en las próximas lecturas").

### Bloque 5 — Documentación y despliegue

18. Actualizar `ideas/niveltoner.md`: encabezado de estado (Fase 2 + widget de Fase 3
    implementadas, fecha; Fase 4 sigue pendiente) y ampliar el checklist §8 con los ítems
    nuevos (archivo:línea de referencia donde aplique).
19. Rebuild de la SPA (AGENTS.md, obligatorio):
    `docker compose run --rm --no-deps frontend sh -c "npm run build"` y avisar hard refresh
    en `http://localhost:8080`. El móvil NO se recompila (sin cambios).

## Verificación final

- `docker compose exec app php artisan test` (suite completa; filtros:
  `--filter=TonerServiceTest`, `--filter=TonerPanelTest`).
- Revisar que ningún archivo de facturación/rentabilidad fue tocado (D1): `git diff --stat`
  no debe incluir `InvoiceCalculationService`, `ProfitabilityService`, `InvoiceService`.
- Smoke manual en 8080: dashboard con usuario de pruebas (credencial `password`):
  widget presente con permiso, ausente sin él; detalle de impresora con lecturas con nivel
  muestra estimados.

## Riesgos y salvedades

- **Arranque en frío**: con pocas lecturas con nivel (captura desde 2026-09-12) casi todo
  devolverá null — es el comportamiento esperado (decisión 2), la UI debe verse bien vacía.
- **N+1 del panel**: mitigado con la query en lote del paso 8; si la flota crece a cientos,
  cachear 5 min como `dashboard.flujo_caja` (fuera de alcance ahora).
- **Lecturas duplicadas/anómalas**: orden fecha+id y descarte de pares Δ≤0 (decisión 7).
- **`article_deliveries` sin `impresora_id`**: la correlación es por contrato (limitación
  conocida y aceptada; la atribución fina es el enhancement fuera de alcance).
