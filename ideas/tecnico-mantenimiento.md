# Ideas — Perfil del técnico: condición de flota, taller, analítica y preventivos

> **Estado:** ✅ **Terminada** (2026-09-22). Las cinco fases implementadas con
> tests: F1 analítica con rango de fechas y reportes de piezas/fallas
> (`765b3b2`), F2 condición técnica con transiciones automáticas, guardas de
> asignación y deshuese (`5762e02`), F3 dashboard Taller (`6745a5d`), F4 origen
> de piezas con snapshot congelado en órdenes (`bde3534`), F5 planes preventivos
> por meses/páginas con bandeja de sugerencias y `maintenance:sync-plans` diario
> (`fb25c84`). El perfil del técnico se documenta en
> `docs/manual-usuario/04-tecnico-mantenimiento.md`.
> **Origen:** sesión 2026-09-10. Analiza el código real (enums, servicios,
> controladores, migraciones, frontend) antes de redactarse.
> Idea original: el sistema sirve bien al operador y al dueño, pero ¿sirve al
> **responsable técnico del mantenimiento de la flota**? ¿Sabe cuántas
> impresoras necesitan atención, cuánto cuesta cada una, qué piezas consume,
> qué falla más, si un equipo es funcional / necesita pieza / es deshuese, y
> qué le toca servicio preventivo?

---

## 1. Conclusión ejecutiva

**Los datos crudos ya existen casi todos; lo que falta es el modelo y la vista.**
El sistema registra cada orden con tipo de problema y severidad, cada pieza
usada con costo snapshot, cada gasto por impresora y cada contador de páginas.
Lo que **no** existe es:

1. **Condición técnica** de la impresora (hoy `estado` mezcla ubicación
   comercial con salud del equipo; `EN_ALMACEN` no dice si funciona).
2. **Origen de las piezas** (original vs compatible/refacción) — ni en
   catálogo ni en el historial de uso.
3. **Planificación preventiva**: no hay periodicidad ("cada 3 meses"), ni
   "próximo servicio", ni agenda; el preventivo de hoy es una orden suelta que
   alguien recuerda crear.
4. **Analítica agregada y por periodo**: fallas más frecuentes, piezas más
   usadas, productividad del área (los KPIs actuales de
   `maintenance-orders/stats` son solo del mes corriente y sin desglose).

Prioridad sugerida: **analítica primero** (barata, solo lectura sobre datos
existentes), **condición técnica y taller después** (migración + máquina de
estado), **preventivos al final** (feature de scheduler más grande, la que más
conversación de diseño merece).

---

## 2. Qué existe hoy — respuesta punto por punto

| Pregunta del técnico | Estado | Evidencia |
|---|---|---|
| ¿Cuántas impresoras necesitan atención? | ⚠️ Parcial | KPIs `mantenimientos_pendientes` e `impresoras_en_mantenimiento` en `DashboardController`; alerta top-5 de órdenes PROGRAMADA. Pero solo cuenta órdenes ya creadas: no hay "necesita atención y nadie ha creado la orden" |
| ¿Cuánto se ha gastado en cada impresora? | ⚠️ Parcial | `ReportService::getPrinterMaintenanceCost` (mantenimiento + gastos + desglose mensual) y `ProfitabilityService::perPrinter` (ingresos/costos/margen/ROI). **Ojo:** los costos NO incluyen insumos entregados (tóner), que suelen ser el costo mayor — deuda ya conocida (PROJECT.md §11.3.1) |
| ¿Qué piezas se usan más? | ❌ No | `articles_used` guarda cada pieza por orden (cantidad + costo snapshot), pero no existe ningún agregado |
| ¿Qué fallas son las más frecuentes? | ❌ No | `maintenance_orders.tipo_problema` existe (NO_IMPRIME, CALIDAD_DEFICIENTE, ATASCOS, ERROR_PANTALLA, OTRO) pero no hay reporte agregado. Además `OTRO` es cajón de sastre sin nota libre estructurada |
| ¿Está disponible para rentar? | ⚠️ Parcial | `EN_ALMACEN` + sin orden PROGRAMADA (D24 bloquea `assignPrinter` con orden abierta). Pero "en almacén" no dice si **funciona** |
| ¿Es funcional / requiere cambio de pieza / descartada para deshuese? | ❌ No | `PrinterStatus` solo tiene EN_ALMACEN / RENTADA / EN_MANTENIMIENTO / DADA_DE_BAJA |
| ¿Tiene piezas originales o refacciones? | ❌ No | `articles` no tiene atributo de origen; `articles_used` solo snapea costo |
| ¿Estadísticas de servicios en un periodo (productividad del área)? | ❌ No | `MaintenanceOrderController::stats`: mes corriente, sin rango, sin socio, sin tiempos de resolución |
| ¿Cuántas disponibles para renta y cuántas para piezas? | ⚠️ Parcial | `impresoras_por_estado` en el dashboard agrupa por los 4 estados; "para piezas" no existe como concepto |
| ¿Plan de mantenimiento general (preventivo cada 3 meses, agenda, visitas)? | ❌ No | No hay periodicidad, ni próximo vencimiento, ni scheduler, ni agenda técnica. Lo más cercano: `tipo_mantto=PREVENTIVO` manual y `VisitType::MANTENIMIENTO` |

Datos afines que **sí** existen y se pueden explotar: `fecha_completado` en
órdenes (permite tiempos), `socio_id` en órdenes (permite productividad por
técnico), `contador_actual` por impresora (permite periodicidad por páginas),
`vida_util_restante` y `garantia_status` como atributos calculados del modelo
`Printer`, severidad CRITICA ya notifica a quienes tienen
`inventario.mantenimiento`.

---

## 3. Diagnóstico: cuatro gaps estructurales

### Gap 1 — `estado` mezcla ubicación comercial con condición técnica

La máquina de estado de impresora responde "**dónde está**" (almacén, cliente,
taller, fuera). El técnico pregunta "**cómo está**" (funciona, cojea, está
muerta, es donante de piezas). Son dimensiones ortogonales: una impresora
`RENTADA` puede `requiere pieza` (fallando en sitio) y una `EN_ALMACEN` puede
ser `para deshuese`. Añadir casos a `PrinterStatus` explota combinatoriamente
y rompe las invariantes existentes (asignación, facturación de renta en
mantenimiento, D24).

### Gap 2 — No hay atributo de origen en piezas

Para decidir compras (¿los compatibles rinden igual que los originales?) y
para diagnosticar (¿la falla la causa el tóner genérico?) hace falta etiquetar
cada pieza como ORIGINAL / COMPATIBLE / REFACCIONADA, y que el uso histórico lo
conserves (snapshot, como ya hace el costo — D3).

### Gap 3 — El preventivo no tiene motor

Una orden preventiva hoy es un acto de memoria humana. No hay definición de
cadencia por impresora/modelo, ni cálculo de "le toca", ni generación
automática, ni agenda. Es el mismo problema que las visitas resolvieron con
`VisitSchedulerService` + job diario idempotente (D8): hay precedente
arquitectónico claro que copiar.

### Gap 4 — La analítica es mes-corriente y sin desglose

`stats()` es un buen comienzo pero no permite "¿cuántos servicios hicimos en
el trimestre?", "¿quién resolvió más?", "¿cuánto tardamos en promedio?", "¿qué
modelo falla más?". Todo es SQL de agregación sobre tablas que ya existen.

---

## 4. Propuesta por fases

> Criterio de orden: **primero lo que solo lee datos existentes** (valor
> inmediato, riesgo casi nulo), **después el cambio de modelo** (condición
> técnica), **al final el feature de scheduler** (más diseño y más superficies).

### Fase 1 — Analítica técnica (solo lectura, sin migraciones)

**Qué responde:** fallas más frecuentes, piezas más usadas, productividad por
periodo y por técnico, % preventivas vs correctivas, tiempos de resolución.

1. **Generalizar `maintenance-orders/stats`** con rango
   (`fecha_desde`/`fecha_hasta`, default mes corriente para no romper la UI
   actual) y desgloses:
   - por `socio_id` (servicios completados, costo manejado) → productividad;
   - por `tipo_problema` (solo CORRECTIVO) → ranking de fallas;
   - por `tipo_mantto` → tendencia preventivo vs correctivo en el tiempo;
   - MTTR: promedio de `fecha_completado − fecha_creacion` por orden
     completada (tiempo de resolución del taller).
2. **Nuevo endpoint `reports/maintenance/top-articles`**: agregación de
   `articles_used` (Σ cantidad, Σ subtotal) filtrable por rango y por
   `tipo_articulo` (REPARACION para el técnico, CONSUMIBLE para compras) y por
   modelo de impresora vía compatibilidad.
3. **Nuevo endpoint `reports/maintenance/failures`**: agregación por
   `tipo_problema` × modelo de impresora (identificar "el modelo que se
   atasca"). Cruce con piezas usadas ("esta falla se resuelve con este kit").
4. **Frontend**: extender `MaintenanceReports.tsx` (ya existe y ya tiene los
   dos reportes actuales) con selectores de rango y las dos tablas nuevas.
   Mantener el patrón: tabla simple, exportación después.
5. *(Opcional en esta fase)* exponer el costo de mantenimiento acumulado vs
   `costo_adquisicion` en el detalle de impresora (regla de decisión de
   reemplazo: "ya gasté en repararla el 60% de lo que costó").

**Coste de piezas por origen** quedará disponible automáticamente al llegar la
Fase 4 (el agregado de Fase 1 solo gana un `GROUP BY origen`).

### Fase 2 — Condición técnica de la impresora (la pieza central)

**Qué responde:** ¿es funcional? ¿requiere cambio de pieza? ¿está descartada
para deshuese? ¿cuántas hay disponibles para renta vs para piezas?

**Modelo de datos:**

```
printers.condicion          varchar  nullable  -- null = desconocida (legacy)
  OPERATIVA        funciona; lista para rentar o trabajando bien
  REQUIERE_ATENCION funciona con fallas leves / necesita revisión; NO bloquea renta
  NO_OPERATIVA     fallada; no debe instalarse ni rentarse
  PIEZAS           descartada para deshuese; donante, nunca se volverá a rentar
printers.condicion_nota     text     nullable  -- qué pieza espera, qué se le extrajo
printers.condicion_actualizada_en timestamp nullable
```

**Por qué un campo ortogonal y no más estados en `PrinterStatus`:** conserva
la máquina de estado existente y sus invariantes (D24, restauración consciente,
facturación de renta durante mantenimiento) intactas; permite combinaciones
reales (`RENTADA` + `REQUIERE_ATENCION`); y `PrinterHistory` ya existe para
auditar cambios con `datos_adicionales`.

**Reglas propuestas (transiciones derivadas de eventos, no manuales solo):**

- Crear orden CORRECTIVA con severidad ALTA/CRITICA → `NO_OPERATIVA` (dentro
  de la transacción de `MaintenanceService::create`).
- Crear orden CORRECTIVA BAJA/MEDIA → `REQUIERE_ATENCION`.
- Completar orden (correctiva o preventiva) → `OPERATIVA`, salvo resultado
  explícito "queda para piezas" (ver flujo de deshuese abajo).
- Todo cambio de condición escribe `PrinterHistory` con evento
  `CONDICION_ACTUALIZADA` (+ condición previa/nueva y motivo).
- **Guard de asignación:** `assignPrinter` rechaza (422) asignar a contrato
  impresoras en `NO_OPERATIVA` o `PIEZAS`. `REQUIERE_ATENCION` solo **avisa**
  (banner de confirmación en el wizard, decisión consciente del negocio:
  "se renta y se le da servicio en la primera visita").

**Flujo de deshuese (el "ya está descartada"):**

```
impresora en almacén, falla grave o reparación antieconómica
  → condicion = PIEZAS (queda EN_ALMACEN, bloqueada para asignar,
    con nota "donante": se le van extrayendo piezas)
  → cada pieza extraída se registra como articles_used de una orden
    CORRECTIVA especial (o tipo nuevo DESMANTELAMIENTO — decisión abierta §6.3)
    → descarga stock de... nada; en realidad INGRESA piezas refaccionadas
      (entrada por AJUSTE al almacén, kardex normal)
  → cuando ya no queda valor: Dar de baja (DADA_DE_BAJA, flujo existente)
```

El punto fino es el **ingreso de piezas extraídas** al inventario (hoy todo
artículo nace de compras). Ver §6.3.

**Superficies:** migración, `Printer` (fillable/casts/atributo calculado
`disponible_para_renta` = EN_ALMACEN ∧ condicion OPERATIVA ∧ sin orden
abierta), `PrinterService` (eventos + guards), `PrinterResource` (exponer
condición), catálogo web (columna/filtro/chips de condición), detalle
impresora (sección condición + botón de cambio manual con motivo), móvil
(chip en catálogo e instalación).

### Fase 3 — Dashboard "Taller" (la casa del técnico)

**Qué responde:** "mi cola de trabajo de hoy" y "salud de la flota" en una
pantalla. Origen del perfil: hoy los roles son administrador/operador/
operador-inventario; el técnico sería un usuario con `inventario.mantenimiento`
(+ `inventario.impresoras` lectura). No hace falta un rol nuevo para el MVP
(decisión abierta §6.5).

**Página nueva `Inventario › Taller`** (o "Panel técnico"), permiso
`inventario.mantenimiento`, composición:

1. **KPIs de cabecera:** impresoras NO_OPERATIVAS (necesitan atención),
   REQUIERE_ATENCION, en taller (`EN_MANTENIMIENTO`), disponibles para renta
   (EN_ALMACEN + OPERATIVA), para piezas (condicion PIEZAS), preventivos
   vencidos/próximos (cuando exista Fase 5).
2. **Cola del taller:** órdenes PROGRAMADA ordenadas por severidad y
   antigüedad (días desde `fecha_creacion` — el "aging" que hoy no se ve
   en ningún lado), con chip de impresoras NO_OPERATIVAS **sin orden**
   (prompt para crearla).
3. **Disponibilidad de flota:** distribución estado × condición (matriz pequeña
   o barras apiladas): la respuesta visual a "cuántas puedo rentar y cuántas
   son candados".
4. **Piezas del técnico:** artículos REPARACION bajo umbral (ya existe la
   señal de stock bajo; filtrarla por tipo para este público).
5. **Actividad reciente / productividad mes:** completadas del mes, MTTR,
   % correctivas (ya calculados; darles hogar).

**Notas de implementación:** nuevo endpoint `GET /taller/dashboard` (o
`/dashboard?perfil=tecnico`) que agregue lo anterior en una sola respuesta
 cacheada (patrón `DashboardController` con `Cache::remember` 5 min). El
dashboard general ya filtra widgets por permiso; esta página es el análogo
para el perfil técnico. El dashboard general podría luego enlazar
("Ver taller →").

### Fase 4 — Origen de piezas (ORIGINAL / COMPATIBLE / REFACCIONADA)

**Qué responde:** ¿qué lleva instalado cada equipo? ¿los compatibles salen
más caros a la larga?

1. Migración: `articles.origen` enum (`ORIGINAL`, `COMPATIBLE`,
   `REFACCIONADA` — pieza recuperada de un deshuese), nullable para no
   forzar re-capturar el catálogo viejo de golpe (se completa al editar).
2. `articles_used.origen_snapshot`: congelar el origen al momento del uso
   (D3: el hecho histórico no se recalcula; si mañana reclasificas el
   artículo, las reparaciones de ayer siguen diciendo lo que se puso).
3. UI: campo en formulario de artículo (con default por subtipo si se quiere),
   columna en el picker de piezas de la orden, chip en el detalle de orden.
4. Analítica: el reporte de piezas más usadas (Fase 1) gana desglose por
   origen; costo medio de mantenimiento por origen de pieza; (con
   `niveltoner.md` si se implementa) rendimiento real de tóner original vs
   compatible — la métrica que justifica (o no) comprar compatibles.

### Fase 5 — Planes de mantenimiento preventivo y agenda

**Qué responde:** "servicio preventivo 1 vez cada 3 meses", "¿a qué impresora
le toca o se le acerca?", agendar servicios y visitas técnicas.

**Entidad nueva `maintenance_plans`:**

```
id, printer_model_id (nullable), printer_id (nullable),   -- modelo (default) o impresora (override)
activo
periodicidad_meses     int nullable   -- ej. 3
periodicidad_paginas   int nullable   -- ej. 50000 (usa contador_actual / lecturas)
ventana_aviso_dias     int default 15 -- "próximo" antes de la fecha
ultimo_servicio_fecha  date nullable  -- derivado de la última orden PREVENTIVO completada
ultimo_servicio_contador int nullable
proximo_servicio_fecha date nullable  -- cache computada
proximo_servicio_contador int nullable
```

Reglas: plan por **modelo** como default + override por impresora (el mismo
patrón de compatibilidad artículo↔modelo que ya usa el inventario). Se
considera cumplido el ciclo cuando existe orden PREVENTIVO completada
posterior a la última programación (la orden ya escribe `fecha_completado`).

**Scheduler (nuevo job diario, gemelo del de visitas):**

- `maintenance:generate-upcoming` corre tras `visits:generate-upcoming`
  (02:00 America/Cancun).
- Para cada plan activo: si `proximo_servicio_fecha ≤ hoy + ventana_aviso`
  (o `contador_actual ≥ proximo_servicio_contador − margen`), **crea la orden**
  PREVENTIVO PROGRAMADA con `fecha` = fecha de vencimiento.
- **Idempotencia** (lección D8): no crear si ya existe orden PROGRAMADA para
  el mismo (impresora, plan, ciclo). El guard anti-duplicado de D24 ya
  bloquea dos órdenes abiertas por impresora — compatible.
- Al **completar** la orden preventiva (`MaintenanceService::complete`), en la
  misma transacción recalcular `proximo_*` desde la fecha/contador de
  completado. Evento en `PrinterHistory`.

**Decisión clave (§6.6): ¿la orden nace sola o pasa por una bandeja de
sugerencias?** Recomendación inicial: **bandeja** — el job marca "vencidos" y
"próximos" y el técnico/admin confirma la creación (con "crear todas" en
masivo). Auto-creación pura es más mágica pero genera órdenes basura si el
plan está desatendido; empezar conservador.

**Agenda técnica:**

- Las órdenes PROGRAMADA ya tienen `fecha` y `socio_id`: una vista de
  calendario (semana/mes) de órdenes al lado del calendario de visitas
  existente. Mínimo viable: filtro en la lista de mantenimiento por rango de
  fechas + badge en el día del calendario de operaciones.
- **Servicio en sitio vs taller:** si la impresora está RENTADA, el preventivo
  naturalmente se acopla a la **próxima visita programada del contrato**
  (`VisitType::MANTENIMIENTO` ya existe): la sugerencia puede decir "coincide
  con la visita del 14-oct → asignar socio de esa visita". Si va al taller,
  fluye por el retiro existente (D24 ya permite retirar con orden preventiva).
  En sitio el `socio_id` de la orden = socio de la visita; en taller = técnico
  interno.

**KPIs que se desbloquean:** cumplimiento del plan (% preventivos hechos a
tiempo), % correctivas (ya existe; con preventivos reales se vuelve la métrica
de salud de flota), MTBF por impresora/modelo (días o páginas entre fallas).

---

## 5. Máquina de estado propuesta (condición técnica)

```
                    ┌──────────────────────────────────────────┐
                    ▼                                          |
  (alta) ──► OPERATIVA ──► REQUIERE_ATENCION ──► NO_OPERATIVA ─┘
                ▲    ▲              |                  |
                |    └──────────────┘                  | reparación completada
                |           falla leve                  ▼
                |        (orden BAJA/MEDIA)        PIEZAS (terminal*)
                |                                        |
                └── orden completada ◄───────────────────┘
                    (solo si se repara ANTES de decidir deshuese)

  * PIEZAS → DADA_DE_BAJA (estado comercial) cuando se agota el valor.
    PIEZAS es terminal en condición (no vuelve a OPERATIVA salvo reversión
    manual explícita de un admin con motivo — decisión abierta §6.4).
```

Cambios manuales permitidos siempre con motivo (auditoría en
`PrinterHistory`); los automáticos (por eventos de órdenes) son el camino
feliz que evita que el campo se desactualice.

---

## 6. Decisiones abiertas (dudas de diseño)

1. **¿`REQUIERE_ATENCION` bloquea la asignación a contrato?** Recomendación:
   no bloquear, solo advertir en el wizard (el negocio puede decidir "se renta
   y se atiende en la primera visita"). `NO_OPERATIVA` y `PIEZAS` sí bloquean
   (422).
2. **¿La condición se aplica también a impresoras RENTADA o solo a las que
   están en almacén/taller?** Tiene sentido en ambas (una rentada puede
   cojear), pero la UX del cambio manual debe ser muy explícita para no
   confundir con `EN_MANTENIMIENTO`.
3. **Piezas de deshuese:** ¿cada pieza extraída del donante es un `Article`
   nuevo (stock de refacciones) con origen `REFACCIONADA`, entrando por
   AJUSTE al kardex? ¿O se modela una orden tipo DESMANTELAMIENTO? Falta
   además decidir el **costo** de esa pieza recuperada (¿costo de la mano de
   obra de extracción? ¿costo proporcional? ¿cero y que el margen mienta
   menos?). Es la pregunta contable más peliaguda del documento.
4. **¿PIEZAS es reversible?** La vida real dice que a veces "lo iban a
   deshuesar pero salió que era el fusor". Recomendación: reversión manual
   admin con motivo obligatorio, nada automático.
5. **Permiso del taller:** ¿reusar `inventario.mantenimiento` (MVP, cero
   fricción) o crear `inventario.taller`? Si el perfil técnico crece (ver
   §6.7), un permiso propio evita dar mantenimiento completo a quien solo
   debe ver su cola. Recomendación: reusar ahora, separar si duele.
6. **Preventivos: auto-creación vs bandeja de sugerencias** (§Fase 5).
   Recomendación: bandeja con acción masiva primero.
7. **¿Técnico como rol propio del sistema?** Hoy `socio` = operador de campo
   genérico y las órdenes ya tienen `socio_id`. Para productividad individual
   basta con que las órdenes se asignen bien; un rol `tecnico` dedicado (con
   vista móvil "mis órdenes", hoy el móvil ya tiene
   `CompleteMaintenancePage`) sería el paso siguiente si el área técnica
   crece o se separa de los operadores.
8. **Periodicidad por páginas vs por meses:** ¿el contador del preventivo usa
   `printers.contador_actual` (que se actualiza con lecturas) o las lecturas
   del contrato? Coherencia: `contador_actual` es la fuente existente; si hay
   impresoras en almacén sin lecturas recientes, solo la cadencia temporal
   aplica. ¿Ambas condiciones con "el que ocurra primero"? Recomendación: sí.
9. **¿El gasto por impresora debe incluir insumos entregados (tóner)?** Es
   deuda previa del sistema (PROJECT.md §11.3.1) pero este perfil la hace más
   visible: "cuánto se ha gastado en cada impresora" sin tóner es una
   respuesta a medias. Requiere decidir si `article_deliveries` entra al costo
   por impresora (snapshot ya existe) — tocar `ProfitabilityService` y los
   márgenes que ya reporta el sistema.
10. **`tipo_problema OTRO`:** ¿se amplía el catálogo de fallas (FUSOR, TAM,
    RODILLO, SENSOR...) o se libera nota estructurada? Más granularidad =
    mejor analítica, más fricción de captura. Recomendación: ampliar con
    moderación los 3-4 fallas mecánicas más comunes del negocio real y
    mantener OTRO.

---

## 7. Plantilla de evaluación (§11.6 de PROJECT.md)

- **Tipo:** negocio + UX (nuevo perfil de usuario) con toques de arquitectura
  (scheduler, máquina de estado nueva)
- **Zona:** Fases 1/3/4 = corteza sobre núcleo sano; Fase 2 toca núcleo
  (máquina de estado de impresora, guards de asignación); Fase 5 toca núcleo
  (transacciones de `MaintenanceService::complete`, scheduler)
- **Invariantes tocadas:** la 6 ("una impresora no está activa en dos
  contratos") se refuerza con el guard de condición; snapshots de costo se
  extienden con origen (D3); no se toca dinero/stock salvo el ingreso de
  piezas de deshuese (§6.3) y el costo por impresora (§6.9), ambos con diseño
  pendiente
- **Decisiones tocadas:** extiende D3 (snapshot de origen), D7 (PIEZAS como
  paso previo a la baja, no nueva eliminación), D8 (idempotencia del nuevo
  scheduler de preventivos, misma lección), D24 (el guard anti-duplicado
  convive con las órdenes generadas por plan). No contradice ninguna.
- **Superficies afectadas:** migraciones (`printers.condicion`,
  `articles.origen`, `articles_used.origen_snapshot`, tabla
  `maintenance_plans`), backend (servicios, controladores de reportes,
  scheduler), frontend (Taller, reportes, catálogo/detalle de impresoras,
  artículos), móvil (chips de condición, agenda si procede)
- **Riesgo si no se hace:** el área técnica opera de memoria (preventivos que
  no ocurren, flota muerta que nadie contabiliza), compras de piezas sin
  datos de consumo real, decisiones de reemplazo sin costo acumulado real
- **Riesgo si se hace mal:** (a) condición desactualizada si no se deriva de
  eventos; (b) explotar `PrinterStatus` con estados-híbridos; (c) órdenes
  preventivas fantasma si el scheduler no es idempotente; (d) costo por
  impresora incongruente con la rentabilidad si se integra tóner solo en un
  lado; (e) ingreso de piezas de deshuese que rompa el kardex si no pasa por
  `InventoryService`
- **Verificación:** tests de transiciones de condición (orden crítica →
  NO_OPERATIVA; completada → OPERATIVA), guard de asignación (422 con
  NO_OPERATIVA/PIEZAS), idempotencia del job de preventivos (dos corridas no
  duplican), snapshot de origen en `articles_used`, y la suite existente
  (`docker compose exec app php artisan test`)
- **Prioridad sugerida:** F1 media-alta (barata, responde ya) · F2/F3 alta
  (el corazón del perfil) · F4 media · F5 media-alta pero con diseño
  conversado — criterio general del proyecto: dinero/integridad > cobertura
  de flujo > UX

---

## 8. Mapa de superficies (referencia rápida)

| Fase | Superficie | Archivos |
|---|---|---|
| 1 | Stats con rango/desgloses | `backend/app/Http/Controllers/MaintenanceOrderController.php` (`stats`), `ReportService` |
| 1 | Reportes fallas / piezas | `MaintenanceReportController`, `routes/api.php` (grupo `inventario.mantenimiento`) |
| 1 | UI reportes | `frontend/src/pages/inventory/maintenance/MaintenanceReports.tsx`, `hooks/useMaintenanceReports.ts` |
| 2 | Migración condición | `backend/database/migrations/*_add_condicion_to_printers_table.php` |
| 2 | Eventos + guards | `PrinterService`, `MaintenanceService` (`create`/`complete`), `ContractService::assignPrinter`, `PrinterHistory` |
| 2 | Recursos/UI | `PrinterResource`, `frontend/src/pages/inventory/printers/*` (chips, filtro, sección condición), `mobile/src` (catálogo/instalación) |
| 3 | Dashboard taller | endpoint nuevo + `frontend/src/pages/inventory/taller/` (nueva), `config/nav.ts` |
| 4 | Origen piezas | migraciones `articles` + `articles_used`, formularios artículos, picker de la orden |
| 5 | Planes preventivos | tabla `maintenance_plans`, `MaintenancePlanService` + job en `routes/console.php`, bandeja UI, `MaintenanceService::complete` (recálculo próximo), calendario |
| 5 | Agenda | lista/calendario de órdenes por fecha, acople con `VisitType::MANTENIMIENTO` |

---

## 9. Sugerencia de orden de trabajo

```
F1 Analítica ──► F2 Condición ──► F3 Taller ──► F4 Origen piezas ──► F5 Preventivos+Agenda
 (días)          (migración+guards) (composición)  (migración chica)     (la grande, conversar §6 antes)
```

Cada fase entrega valor visible por sí sola y no bloquea las siguientes;
F5 es la única que conviene diseñar con una sesión de negocio dedicada
(cadencias reales, quién agenda, servicio en sitio vs taller).
