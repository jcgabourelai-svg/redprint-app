# Plan — niveltoner F4: costo de tóner en rentabilidad + costo por página estimado

## Contexto

`niveltoner.md` Fase 4 pide que el costo del tóner entregado entre a la
rentabilidad y que exista el "costo por página con insumo". Hallazgo clave
(verificado): `ProfitabilityService::costByPrinter` solo suma `gastos`
(`printer_expenses`) + `mantenimiento` (órdenes); las `article_deliveries`
(con `costo_unitario`/`subtotal` snapshot, D3) **no entran en ningún costo
hoy** — el parenthetical de `niveltoner.md` ("ya existe como costo") es falso.

Regla inviolable (D1 / niveltoner.md): **solo estimativo/reportístico**. No se
toca `InvoiceCalculationService`, facturación ni cobro. Nada de migraciones.

## Decisiones cerradas con el usuario

1. **Mecanismo**: costo de caja — Σ `subtotal` de entregas TONER del periodo
   como componente de costo — más la métrica estimada
   `costo_toner_por_pagina = costo promedio del tóner ÷ rendimientoReal`.
2. **Atribución por impresora**: reparto **parejo** entre las impresoras con
   pivot activo del contrato (`contract_printer.activa = true`, misma foto que
   usa la atribución de ingresos D19). Contrato de 1 impresora ⇒ carga
   completa. Nivel cliente: exacto (la entrega vive a nivel contrato).
3. **Costo por página estimado**: incluido, etiquetado "estimado", null cuando
   no hay datos (nunca inventar).

## Cambios backend

### 1. `TonerService` — estimación de costo por página (batch)

`backend/app/Services/TonerService.php`:

- Nuevo método público batch:
  `costoTonerPorPaginaPorImpresora(array $printerIds): array<string, array{costo_toner_promedio: ?float, costo_toner_por_pagina: ?float}>`
  - Contratos por impresora: una query a `ContractPrinter::whereIn('impresora_id', ...)`
    agrupada (mismo alcance que `entregasToner`: **todos** los contratos
    históricos de la impresora).
  - Entregas TONER: una query batch a `ArticleDelivery` con
    `whereHas('article', subtipo=TONER)` para esos contratos, agregando por
    contrato `Σ cantidad` y `Σ(cantidad × costo_unitario)` (sin filtro de
    fechas: es estimación de largo plazo; ignorar filas con costo null).
  - `costo_toner_promedio` por impresora = agregado ponderado sobre sus
    contratos: `Σ(cantidad×costo) ÷ Σ cantidad`; null sin entregas.
  - `costo_toner_por_pagina` = `costo_toner_promedio ÷ rendimientoReal(printer_model_id)`
    (memoizar `rendimientoReal` por model_id dentro de la llamada); null si
    cualquiera falta (p. ej. sin niveles capturados).
- `estimados(Printer $printer)`: agregar al retorno
  `costo_toner_promedio` y `costo_toner_por_pagina` (reusa el batch con
  `[id]`). Aditivo: `TonerController::printer` no cambia.

### 2. `ProfitabilityService` — componente `insumos_toner`

`backend/app/Services/ProfitabilityService.php`:

- `costByPrinter(array $printerIds, string $inicio, string $fin)`:
  agregar tercera clave `insumos_toner` por impresora:
  - Una query batch: `ArticleDelivery` join `articles` (`subtipo='TONER'`)
    `whereBetween('fecha_creacion', [inicio, fin])` para los contratos con
    pivot activo de `$printerIds`, agregando `Σ subtotal` por `contrato_id`
    (usar `subtotal`, que ya es el costo snapshot de la entrega).
  - Por contrato: repartir su total parejo entre sus impresoras con pivot
    `activa=true` presentes en `$printerIds` (shares suman el total del
    contrato).
- `perPrinter(...)`: por cada fila
  - `costos = gastos + mantenimiento + insumos_toner` (margen/roi se
    recalculan solos).
  - Campos nuevos aditivos: `insumos_toner` (float), `paginas_periodo`
    (int ≥ 0; `Reading::whereIn('impresora_id')->whereBetween('fecha')`
    `SUM(paginas_periodo)` agrupado, una query batch),
    `costo_toner_por_pagina` (?float, vía `TonerService` batch; inyectar
    `TonerService` por constructor).
  - Cero entregas/niveles ⇒ `insumos_toner = 0.0`, `costo_toner_por_pagina = null`.
- `clientProfitability` (`FinanceReportController`): usar `costByPrinter`
  (en vez de `totalCostForPrinters`) para sumar `gastos + mantenimiento +
  insumos_toner` y exponer `insumos_toner` en cada fila. `totalCostForPrinters`
  queda sumando las tres claves (documentar en docblock).
- `topByMargin` hereda sin cambios.

### 3. Contrato de API (aditivo)

- `GET /reports/finance/profitability` (permiso `finanzas.rentabilidad`, sin
  cambios): filas ganan `insumos_toner: number`, `paginas_periodo: number`,
  `costo_toner_por_pagina: number | null`.
- `GET /reports/finance/client-profitability`: filas ganan `insumos_toner: number`.
- `GET /printers/{printer}/toner`: gana `costo_toner_promedio: number | null`
  y `costo_toner_por_pagina: number | null`.

## Cambios frontend (web; móvil sin cambios)

### 4. Realinear `ProfitabilityReport` al API real + columnas nuevas

`frontend/src/pages/finance/reports/ProfitabilityReport.tsx` está desalineado
con el API real (lee `impresora_nombre`/`rentabilidad`/`cliente_nombre`/
`contratos` que el backend no devuelve; el `Select` de periodo manda
`periodo=mayo-2026` que el backend ignora → siempre mes corriente). Alcance
**mínimo pero funcional**:

- `frontend/src/types/finance-reports.ts`: `ProfitabilityData` al contrato
  real (`impresora_id, codigo_negocio, marca, modelo, ingresos, gastos?,
  mantenimiento?, insumos_toner, costos, margen, roi, paginas_periodo,
  costo_toner_por_pagina`) e ídem `ClientProfitability`
  (`cliente_id, razon_social, ingresos, costos, insumos_toner, margen` — sin
  `contratos`/`margen %` que no existen).
- Tabla "por impresora": corregir mapeo y agregar columnas **"Insumos tóner"**,
  **"Páginas"** y **"Costo/pág tóner"** con sufijo "(estimado)" cuando
  `costo_toner_por_pagina !== null` (`—` si null).
- Tabla "por cliente": mapeo `razon_social`, columna "Insumos tóner".
- Periodo: reemplazar el `Select` hardcodeado por dos inputs de fecha
  (`periodo_inicio`/`periodo_fin`) que sí viajen al hook (el hook ya pasa
  `params` tal cual).
- **Dejar como está** (deuda preexistente documentada): tarjeta `mockTrend`,
  totales con sumas de renglones (sobre-cuentan ingresos en multi-impresora,
  D19), botón Exportar decorativo, badges 12%/8%/15%.

### 5. Tarjeta de tóner del detalle de impresora

`frontend/src/components/printer/TonerEstimadoCard.tsx`: junto a
"Rendimiento real del modelo (mediana)", agregar líneas
"Costo tóner promedio: $X" y **"Costo por página (estimado): $X.XX"** cuando
existan (`—` si null). Actualizar `TonerEstimados` en
`frontend/src/types/api.ts` (166-174) con los dos campos nullable.

## Tests

`docker compose exec app php artisan test` (suite completa, Docker, ver AGENTS.md).

### 6. Extend `backend/tests/Feature/ProfitabilityServiceTest.php`

- Entrega TONER en contrato de 1 impresora ⇒ `insumos_toner` completo al
  renglón, `costos` y `margen` la incluyen; el gasto tipo 'tinta' preexistente
  no se ve afectado.
- Contrato con 2 impresoras activas y entrega de $600 ⇒ `insumos_toner = 300`
  por impresora (Σ = total), nivel cliente exacto.
- Entrega de artículo no-TONER (subtipo distinto) ⇒ no cuenta.
- Entrega fuera del rango ⇒ no cuenta en el periodo.
- `paginas_periodo` = Σ de lecturas del rango.
- `costo_toner_por_pagina`: null sin niveles capturados; con lecturas con
  niveles (patrón de `TonerServiceTest`: resets ≥30 pts) y entregas con
  `costo_unitario` ⇒ valor = promedio ponderado ÷ mediana.
- Contrato con entregas y sin pivotes activos ⇒ cae del reporte por
  impresora/cliente (limitación documentada).

### 7. Extend `backend/tests/Feature/TonerServiceTest.php`

- `costoTonerPorPaginaPorImpresora`: promedio ponderado por cantidad; null sin
  entregas; null sin `rendimientoReal`; dos impresoras del mismo modelo no
  recalculan rendimiento dos veces (memoización, opcional de observar).
- `estimados()` expone los dos campos nuevos (aditivo; tests existentes de
  `TonerPanelTest`/`TonerLevelTest` deben seguir verdes sin edición).

## Documentación

### 8. `ideas/niveltoner.md`

- Marcar Fase 4 COMPLETADO con fecha y checklist (mismo formato que F1–F3):
  insumos en ProfitabilityService, costo por página estimado, columnas UI,
  tests. Corregir el parenthetical falso ("insumo entregado ya existe como
  costo" → señalar que F4 lo agregó).

### 9. `TODO.md`

- Quitar `niveltoner.md` F4 del backlog; actualizar "Última actualización" y
  la nota de cambios.

PROJECT.md queda fuera de alcance (su actualización general ya está
identificada como tarea propia: §5/§6/§8 desactualizados).

## Validación y entrega

1. Suite completa verde: `docker compose exec app php artisan test`
   (incluye facturación intacta — D1).
2. Rebuild del dist web (AGENTS.md, jamás `npm run dev`):
   `docker compose run --rm --no-deps frontend sh -c "npm run build"`.
3. Recargar `http://localhost:8080` con Ctrl+F5; revisar Finanzas →
   Rentabilidad y el detalle de una impresora con lecturas de nivel.

## Riesgos / notas

- **Atribución mixta preexistente**: ingresos siguen con convención D19
  (completo a cada activa) mientras insumos se reparten parejo ⇒ en contratos
  multi-impresora el margen por renglón queda ingreso-completo menos
  costo-repartido. Documentado; corregir ingresos es otra tarea.
- `rendimientoReal` carga lecturas por modelo: memoizado por llamada; escala
  actual (decenas de impresoras) lo tolera.
- Entregas de contratos sin pivotes activos quedan fuera (caso histórico
  raro, documentado).
- Los totales superiores de la página siguen sobre-contando ingresos en
  multi-impresora (deuda D19 preexistente, no tocada).
