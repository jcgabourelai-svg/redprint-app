# Ideas — Captura de nivel de tóner en lecturas

> **Estado:** Fases 1–4 **implementadas**: captura + `es_color` + alerta
> TONER_LOW (2026-09-12, plan
> `.kilo/plans/1789172943934-nivel-toner-captura-alerta.md`) y
> `TonerService` (estimados) + widget "tóner bajo" del dashboard
> (2026-09-13, plan
> `.kilo/plans/1789332081904-toner-fase2-estimados-widget.md`; ver §8) y
> costo de tóner en rentabilidad + costo por página estimado (2026-09-23,
> plan `.kilo/plans/1790218580312-niveltoner-f4-costo-insumo.md`).
> **Origen:** sesión 2026-09-04. Analiza el código real (lecturas, entregas,
> FieldRecord, cola offline móvil) antes de redactarse.
> **Regla de oro de este documento:** el nivel de tóner es un dato **informativo
> y estimativo**. NUNCA alimenta facturación ni cobro (respeta D1 de PROJECT.md:
> el dinero se calcula solo con contador y contrato).

---

## 1. Objetivo

Agregar a la captura de lecturas (sobre todo en la app móvil `/m/`, que es donde
el operador está frente a la impresora) un campo opcional de **nivel de tóner
(%)** por color. Aprovechar ese dato para estimados operativos y alertas.

La duda original que motivó este documento:

> "En la práctica es difícil saber cuándo se le cambia un tóner a la impresora,
> así que creo sería meramente informativo el dato, a menos que encuentres forma
> de explotarlo."

**Respuesta corta:** el dato tiene más jugo del que parece, porque el evento
"cambio de tóner" **ya existe en el sistema** o se autodetecta desde el propio
historial de niveles. Ver §2.

---

## 2. Hallazgo clave: sí se puede saber cuándo se cambia un tóner

Tres fuentes, en orden de confiabilidad:

1. **`article_deliveries`** — en el modelo de negocio (renta CPC con visitas del
   socio), el tóner casi siempre lo entrega el operador y queda registrado con
   fecha, contrato y artículo (`articles.subtipo = 'TONER'`). Eso **es** un
   evento de reemplazo (o muy cercano a uno). Ya existe, no hay que capturar
   nada nuevo.
2. **Reset de nivel entre lecturas** — una vez capturado el nivel, si entre dos
   lecturas consecutivas de la misma impresora el nivel pasa de `8% → 100%`,
   se detectó un cambio de tóner **sin que nadie lo registre**. Es un evento
   autodetectado por el propio dato nuevo.
3. **Órdenes de mantenimiento** — si el tóner se cambió en taller, hay
   `maintenance_orders` + `articles_used` con fecha.

Además, para los estimados más valiosos **ni siquiera hace falta el evento de
cambio**: con ≥2 lecturas consecutivas que traigan nivel, la **pendiente de
consumo** (cuántos % baja por página impresa) permite proyectar páginas
restantes y días hasta agotarse. El contador de páginas ya existe; el nivel es
la pieza que falta.

---

## 3. Qué se puede derivar (el "jugo")

| Derivado | Fórmula con datos existentes | Valor de negocio |
|---|---|---|
| **Páginas restantes** | `nivel% ÷ (Δ% ÷ Δcontador)` entre dos lecturas con nivel | "A este ritmo le quedan ~800 págs" |
| **Días hasta agotarse** | páginas restantes ÷ promedio diario de páginas del contrato | Planear **llevar tóner en la próxima visita programada** (evita viajes de emergencia) |
| **Rendimiento real por modelo/SKU** | Δcontador entre dos resets de nivel (o entre entrega y agotamiento) | Cotejar contra el rendimiento nominal del fabricante; detectar tóners malos, reflujos o compatibles de baja calidad |
| **Costo por página con insumo** | `costo_unitario` del tóner entregado ÷ rendimiento real | Responde la pregunta abierta §11.3.1 de PROJECT.md (rentabilidad hoy NO incluye costo de tóner). Es el número que necesita el dueño para tarifar el excedente |
| **Anomalía de insumo** | nivel sube sin entrega registrada; o baja mucho más rápido de lo que sugieren las páginas | Señal de calidad de datos / fuga / cliente que cambia tóner por su cuenta |

Nota sobre el "anomalía de insumo": no es un bloqueo (no es 422), es una
**señal informativa** para el admin. El nivel lo teclea el operador a ojo;
castigarlo con errores duros desincentivaría la captura.

---

## 4. Diseño propuesto por fases

### Fase 1 — Captura (el pedido original; riesgo bajo, autocontenida)

**Migración** — columna jsonb nullable en `readings`:

```
niveles_toner jsonb nullable   -- ej. {"k": 80, "c": null, "m": null, "y": null}
```

Por qué jsonb y no columnas separadas:

- La flota es mixta: mono (HP 26A/79A, Canon 054, Brother TN-2420…) y color
  (HP 410X CMY en el seeder). Mono solo captura `k`.
- Deja puerta a `tambor` / `bandeja_residuos` sin otra migración.
- Nullable ⇒ cero impacto en lecturas históricas, en la cola offline y en
  clientes existentes.

Contrapartida (decisión a discutir): el proyecto prefiere columnas explícitas
en español (principio §3.5 de PROJECT.md). Si se prefiere ortodoxia:
`nivel_toner_negro`, `nivel_toner_c`, `nivel_toner_m`, `nivel_toner_y` como
4 smallint nullable. Es equivalente en funcionalidad; jsonb gana solo en
extensibilidad futura.

**Backend:**

- `StoreReadingRequest`: validar
  `'niveles_toner' => 'nullable|array'` + `'niveles_toner.k' => 'nullable|integer|min:0|max:100'`
  (ídem c/m/y). **Whitelist estricta de claves** (no aceptar json arbitrario).
- `Reading::$fillable` + cast `'niveles_toner' => 'array'`.
- `ReadingResource`: exponer el campo.
- `ReadingService::captureReading` no cambia (el campo viaja en `$data` y es
  inmutable como el resto de la lectura).

**Móvil (`CaptureReadingPage.tsx`):**

- Sección colapsable **"Nivel de tóner (%)"** debajo del contador.
- Input K siempre; inputs C/M/Y solo si el modelo es color (derivar de
  `printer_model` o un toggle manual — a discutir, ver §6).
- **Botones rápidos 25 / 50 / 75 / 100**: el operador lee barras aproximadas en
  el panel de la impresora, no un número exacto. Captura en pasos de ~25% es
  mejor que exigir precisión falsa.
- `ReadingPayload` en `mobile/src/lib/db.ts`: añadir `niveles_toner?` — la cola
  offline (SyncManager) transporta el payload como objeto plano, no requiere
  cambios adicionales (D5 intacto).

**Paridad FieldRecord (D15):**

- Mismo campo `niveles_toner` en la captura de campo cruda
  (`FieldRecord::$fillable` + migración + validación en `FieldRecordService`)
  y passthrough al regularizar la lectura.

**Web (display):**

- Detalle de lectura: chips con niveles por color.
- Detalle de impresora: mini-tendencia de los últimos niveles K (y CMY si hay).
- Listado de lecturas: columna opcional.

### Fase 2 — Estimados (backend, servicio nuevo)

`App\Services\TonerService` (sin tocar `ReadingService`):

- `paginasRestantes(Impresora $p): ?int` — desde la pendiente entre las dos
  últimas lecturas con nivel.
- `diasParaAgotarse(Impresora $p): ?int` — páginas restantes ÷ promedio diario
  de páginas del contrato (lecturas del contrato ÷ días).
- `cambiosDetectados(Impresora $p): Collection` — pares de lecturas donde el
  nivel de un color subió (reset ⇒ cambio de tóner), con correlación opcional
  a la `ArticleDelivery` de TONER más cercana (±7 días).
- `rendimientoReal(int $printerModelId, ?int $articuloId): ?int` — **mediana**
  de páginas entre resets (mediana, no promedio: los niveles capturados a ojo
  generan outliers).

Reglas del servicio:

- Todo devuelve `null` con datos insuficientes (nunca inventar).
- Todo se etiqueta "estimado" en la UI.
- Nunca entra a facturación, precios ni `InvoiceCalculationService`.

### Fase 3 — Alertas operativas (el mayor ROI)

- Al guardar una lectura con `k <= umbral` (ej. 15%, configurable): crear
  `Notification` a usuarios con permiso de operaciones. El tab "Alertas" del
  móvil ya es la bandeja de notificaciones → aterriza ahí gratis.
- Widget en dashboard (web): "Impresoras con tóner bajo" **ordenado por
  días-para-agotarse** y cruzado con la **próxima visita programada** del
  contrato → "Llévalo el día 12". Esto conecta insumos con el loop de visitas,
  que es el corazón operativo del sistema.
- A diferencia de las notificaciones de stock bajo (§10 de PROJECT.md, que
  siguen sin scheduler), esta alerta nace **disparada por evento** (la captura
  de la lectura), no requiere scheduler.

### Fase 4 — (el oro) Costo por página real

- `rendimientoReal` + `costo_unitario` del tóner entregado ⇒ costo por página
  con insumo.
- Alimentar `ProfitabilityService` como costo adicional de la impresora
  (hallazgo de la implementación: las `article_deliveries` **no** entraban en
  ningún costo antes — el parenthetical original "insumo entregado ya existe
  como costo" era falso; F4 lo agregó como componente `insumos_toner`).
- Responde §11.3.1 de PROJECT.md y da el número para tarifar excedentes con
  margen conocido. **Solo estimativo/reportístico**; no cambiar la fórmula de
  facturación sin una discusión propia.

---

## 5. Plantilla de evaluación (§11.6 de PROJECT.md)

- **Tipo:** negocio (+ UX móvil)
- **Zona:** núcleo de dominio (extensión de `Reading`, entidad inmutable)
- **Invariantes tocadas:** ninguna — la lectura sigue inmutable; el campo es
  nullable y opcional; no hay cálculo de dinero nuevo
- **Decisiones tocadas:** extiende D5 (payload offline, sin cambios de
  clasificación de errores) y D15 (paridad FieldRecord). No contradice ninguna.
- **Superficies afectadas:** migración, backend (Request/Resource/Model/Service
  nuevo), móvil (captura + payload offline), frontend (display), luego
  notificaciones/dashboard
- **Riesgo si no se hace:** se sigue sin visibilidad de insumos en campo; el
  costo por página real permanece desconocido (§11.3.1)
- **Riesgo si se hace mal:** (a) aceptar json arbitrario sin whitelist;
  (b) usar el estimado para cobro; (c) exigir precisión falsa en la captura
  (mata la adopción del operador); (d) estimados basados en promedio en vez de
  mediana (outliers de captura a ojo)
- **Verificación:** tests de captura con `niveles_toner` (validación, offline,
  FieldRecord), tests de `TonerService` (pendiente, reset, mediana);
  `docker compose exec app php artisan test`
- **Prioridad sugerida:** media — no toca dinero, pero Fase 3 (avisos
  pre-visita) tiene ROI operativo directo

---

## 6. Decisiones abiertas (para la discusión)

1. **jsonb `niveles_toner` vs 4 columnas smallint.** jsonb = extensible
   (tambor, residuos); columnas = ortodoxia del proyecto (español explícito).
   Recomendación: jsonb con whitelist estricta de claves `k/c/m/y`.
2. **¿Cómo sabe el móvil si la impresora es color?** Hoy `printers` no tiene
   campo de mono/color. Opciones: (a) columna `es_color` en `printer_models`
   (dato de catálogo, correcto a largo plazo), (b) toggle manual en la captura
   (rápido, propenso a olvido), (c) capturar siempre CMY opcional sin
   preguntar. Recomendación: (a) en Fase 1 si el catálogo ya se edita seguido;
   si no, (c) como puente.
3. **Umbral de alerta:** ¿15%? ¿por contrato/impresora? ¿global en config?
   Recomendación inicial: constante simple en `TonerService` (config solo
   cuando alguien pida variarlo).
4. **¿La Fase 3 notifica también al socio de la visita siguiente**, o solo al
   admin? El socio es quien puede cargar el tóner; el admin decide reposición.
   Recomendación: ambos (la infraestructura de notificaciones ya filtra por
   permiso).
5. **Granularidad de captura:** ¿pasos de 25% (botones) o valor libre 0-100?
   Recomendación: botones rápidos + input libre opcional; guardar lo que
   llegue (0-100).
6. **¿Umbral de "cambio detectado"?** Un reset 30→35% no es cambio. Definir
   p. ej. "subida de ≥30 puntos entre lecturas consecutivas" = cambio. Afinar
   con datos reales.

---

## 7. Riesgos y salvedades honestas

- **El nivel es captura humana aproximada** (barras del panel). Los estimados
  deben ser robustos (mediana), mostrar rangos y decir "estimado". No es un
  dato de precisión fiscal.
- **Hermanos/Brother reportan en pasos gruesos** (a veces "tóner bajo" sin %).
  Si la flota tiene muchas de esas, el estimado por pendiente se degrada; el
  botón "bajo" (ej. 10%) sigue siendo útil para la alerta.
- **Tóner cambiado por el cliente por su cuenta** → nivel sube sin entrega:
  no es error del sistema, es la señal "anomalía de insumo" de §3. Tratarla
  como insight, no como fallo.
- **No hay unicidad server-side por (visita, impresora)** en lecturas (§10
  móvil): los estimados deben tolerar duplicados eventuales (usar la última
  por fecha+id, igual que `getPreviousReading`).

---

## 8. Checklist de implementación

### Fase 1 + alerta — COMPLETADO 2026-09-12

- [x] Migración: `niveles_toner` jsonb nullable en `readings`
- [x] Migración: `niveles_toner` jsonb nullable en `field_records`
- [x] Migración: `printer_models.es_color` boolean + backfill ILIKE sobre pivote
- [x] `Reading`: fillable + cast array
- [x] `FieldRecord`: fillable + cast array
- [x] `StoreReadingRequest`: validación array + k/c/m/y 0-100 + claves cerradas
      (`array:k,c,m,y`) + normalización all-null ⇒ null
- [x] Validación equivalente en `StoreFieldRecordRequest` (staging)
- [x] `ReadingResource` + `FieldRecordResource`: exponer `niveles_toner`
- [x] Regularización de FieldRecord: passthrough a la lectura creada
      (`FieldRecordService::link`)
- [x] `VisitResource::resolveImpresoras`: `es_color` + eager loads
      `contract.activePrinters.printerModel` en VisitController
- [x] Alerta TONER_LOW: `TonerAlertService` (umbral 15%, frescura 7 días,
      dedupe por impresora no-leída, destinatarios `operaciones.lecturas` +
      socio) enganchado en `ReadingService::captureReading`
- [x] API: `PUT /printer-models/{id}` para corregir `es_color` del catálogo
- [x] Móvil `db.ts`: `ReadingPayload`/`FieldRecordPayload.niveles_toner?`
      (sin bump de DB_VERSION; la cola transporta el campo verbatim)
- [x] Móvil `TonerLevelInput` (chips Bajo(10)/25/50/75/100 + input libre)
- [x] Móvil `CaptureReadingPage.tsx`: sección colapsable, K + C/M/Y si
      `es_color` (fallback "+ Es de color"), niveles en tarjeta de resultado
- [x] Móvil `NewFieldRecordPage.tsx`: paridad (solo tipo LECTURA, "+ Colores")
- [x] Web: chips en detalle de lectura, detalle de registro de campo y pestaña
      lecturas del detalle de impresora (`TonerLevelsChips`)
- [x] Tests `TonerLevelTest`: persistencia, validación, retrocompat,
      passthrough de regularización, alerta (destinatarios, dedupe, frescura,
      nivel sano), exposición de `es_color`
- [x] Rebuild dist: `docker compose run --rm --no-deps frontend sh -c "npm run build"`
      y `... mobile ...` (ver AGENTS.md; nunca `npm run dev` en el host)

### Fase 2 (TonerService) + widget de Fase 3 — COMPLETADO 2026-09-13

- [x] `App\Services\TonerService` (nuevo, sin tocar `ReadingService`):
      constantes `UMBRAL_CAMBIO=30`, `DIAS_URGENCIA=14`,
      `VENTANA_PROMEDIO_DIAS=90`, `CORRELACION_DIAS=7`, `PANEL_LIMITE=10`;
      umbral de inclusión reutilizado de `TonerAlertService::UMBRAL` (15)
- [x] `paginasRestantes`/`diasParaAgotarse` por color entre las dos últimas
      lecturas con ese color; pares con Δcontador ≤ 0 o Δnivel ≤ 0 ⇒ null;
      sin contrato activo `dias` = null (las páginas sí se reportan)
- [x] `cambiosDetectados`: reset = subida ≥ 30 pts; correlación con entrega
      TONER ±7 días por contrato (`con_entrega`, `entrega_articulo`);
      sin entrega ⇒ flag informativo, nunca error
- [x] `rendimientoReal(modelId, ?articuloId)`: mediana de tramos entre
      resets (el primer tramo arranca en la primera lectura con nivel);
      con articuloId solo tramos correlacionados a entregas de ese artículo
- [x] `estimados(Printer)` + `panelBajo()` (rentadas, nivel ≤ 15 **o** días
      ≤ 14, orden días asc + nulls al final + nivel asc, cruce con próxima
      visita PENDIENTE/REPROGRAMADA y `urgente_antes_de_visita`), queries
      en lote (flota, lecturas, volumen por contrato, visitas)
- [x] API: `GET /toner/panel` bajo `permission:operaciones.lecturas`
      (routes/api.php) y `GET /printers/{printer}/toner` bajo
      `permission:inventario.impresoras`; `TonerController` delgado
- [x] Tests `TonerServiceTest` (pendiente, descartes, parciales, promedios,
      eventos, mediana con outlier) y `TonerPanelTest` (401/403/200,
      inclusión por nivel y por días, orden, cruce con visita, exclusiones,
      endpoint de impresora)
- [x] Web: tipos `TonerPanelItem`/`TonerEstimados` + hooks `useTonerPanel`/
      `usePrinterToner` (react-query)
- [x] Widget `TonerBajoWidget` en el dashboard (fila propia, gated por
      `operaciones.lecturas`, chips + "~N días" + línea de visita con
      "llevá tóner"/"se agota antes", click → detalle de impresora)
- [x] Card "Tóner (estimado)" en el detalle de impresora: niveles,
      "~N págs / ~N días" por color, último cambio detectado con
      correlación de entrega, rendimiento real del modelo (mediana)
- [x] Sin migraciones ni permisos nuevos; D1 intacto (facturación no
      tocada, verificado con `git diff --stat`)
- [x] Rebuild dist: `docker compose run --rm --no-deps frontend sh -c "npm
      run build"` (móvil sin cambios, no se recompila)

### Fase 4 (costo de tóner en rentabilidad + costo por página) — COMPLETADO 2026-09-23

Plan: `.kilo/plans/1790218580312-niveltoner-f4-costo-insumo.md`. Corrige el
hallazgo de que las `article_deliveries` no entraban en ningún costo.

- [x] `TonerService::costoTonerPorPaginaPorImpresora(printerIds)` (batch):
      promedio ponderado `Σ(cantidad×costo) ÷ Σ cantidad` de las entregas
      TONER de todos los contratos históricos (sin rango: estimación de
      largo plazo), ÷ `rendimientoReal` del modelo memoizado por llamada;
      nulls cuando falta algo (nunca inventar)
- [x] `estimados(Printer)` expone `costo_toner_promedio` y
      `costo_toner_por_pagina` (aditivo; `TonerController::printer` sin
      cambios)
- [x] `ProfitabilityService::costByPrinter` gana `insumos_toner`:
      `Σ subtotal` de entregas TONER del rango por contrato (snapshot D3,
      `DATE(fecha_creacion)` para no perder el último día), repartido parejo
      entre pivots activas — fuente única de costos, ahora tres claves
- [x] `perPrinter`: `costos = gastos + mantenimiento + insumos_toner`
      (margen/roi derivados), filas ganan `gastos`, `mantenimiento`,
      `insumos_toner`, `paginas_periodo` (Σ `readings.paginas_periodo` del
      rango) y `costo_toner_por_pagina` (?float)
- [x] `clientProfitability` usa `costByPrinter` y expone `insumos_toner`
      (exacto a nivel cliente: la entrega vive a nivel contrato);
      `totalCostForPrinters` suma las tres claves
- [x] Web: `ProfitabilityReport` realineado al API real (`codigo_negocio`,
      `margen`, `razon_social`; inputs `periodo_inicio/periodo_fin` que sí
      viajan al hook) + columnas "Insumos tóner", "Páginas" y
      "Costo/pág tóner (estimado)"; `TonerEstimadoCard` agrega costo promedio
      y costo por página estimado; tipos `ProfitabilityData`,
      `ClientProfitability`, `TonerEstimados` corregidos
- [x] Tests: `ProfitabilityServiceTest` (entrega completa, reparto parejo
      con Σ exacto a nivel cliente, no-TONER, fuera de rango, páginas,
      costo/página null-sin-niveles y valor-con-mediana, sin pivotes activas)
      y `TonerServiceTest` (ponderado, nulls, rendimiento compartido por
      modelo, `estimados` aditivo)
- [x] Deuda documentada: ingresos siguen con convención D19
      (completo-por-activa) vs insumos repartidos parejo ⇒ margen por
      renglón mixto en multi-impresora; `mockTrend`/badges/totales de la
      página siguen siendo deuda de UI preexistente
- [x] D1 intacto: `InvoiceCalculationService` y facturación sin tocar,
      suite completa verde (`docker compose exec app` + phpunit)
- [x] Rebuild dist: `docker compose run --rm --no-deps frontend sh -c
      "npm run build"`

## 9. Mapa de archivos tocados (referencia rápida)

| Superficie | Archivo |
|---|---|
| Migración readings | `backend/database/migrations/*_add_niveles_toner_to_readings_table.php` (nueva) |
| Migración field records | `backend/database/migrations/*_add_niveles_toner_to_field_records_table.php` (nueva) |
| Modelo lectura | `backend/app/Models/Reading.php` |
| Modelo registro campo | `backend/app/Models/FieldRecord.php` |
| Validación | `backend/app/Http/Requests/StoreReadingRequest.php` |
| Recurso API | `backend/app/Http/Resources/ReadingResource.php` |
| Servicio estimados (F2) | `backend/app/Services/TonerService.php` (nuevo) |
| Captura móvil | `mobile/src/pages/CaptureReadingPage.tsx` |
| Campo crudo móvil | `mobile/src/pages/NewFieldRecordPage.tsx` |
| Payload offline | `mobile/src/lib/db.ts` (`ReadingPayload`) |
| Display web | `frontend/src/pages/operations/readings/` + detalle de impresora |
| Regularización | `backend/app/Services/FieldRecordService.php` (passthrough) |
