# Plan: Arrastre de consumo en facturación por ciclos (ciclos sin lectura de corte)

## Objetivo

Implementar la regla de negocio acordada: cuando un ciclo de facturación no tiene una **lectura de corte** cercana a su fecha de corte, se cobra solo la renta base y el paquete de páginas incluidas **se acumula**; el siguiente ciclo con lectura de corte compara el consumo de todo el hueco contra el paquete acumulado (N ciclos × `paginas_incluidas`).

Ejemplo canónico (renta 1000, 3000 incluidas): ciclo 1 sin corte → 1000. Ciclo 2 con corte y consumo acumulado de 7000 → 1000 + max(0, 7000 − 2×3000) × excedente = 1000 + 1000×excedente. Hoy el motor compara contra 1×3000 y **sobrecobra**.

## Decisiones cerradas (con el usuario)

1. **Días de gracia post-corte**: se reusa `contracts.dias_gracia` (hoy sin uso en lógica de negocio) con significado "días tras el corte en que una lectura tardía aún cierra el ciclo".
2. **Default**: migración que cambia el default de la columna a **7** y actualiza los existentes con 0/null a 7.
3. **Ciclo parcial final (FINALIZADO)**: allowance completo, sin prorrateo (consistente con D17).
4. **Alcance del arrastre**: solo cuando el rango facturado coincide **exactamente** con los bounds de un ciclo (`CicloFacturacion::bounds`). Afecta: `createDraftBatch`, `recalcular` de esos borradores, y la estimación de pendientes (`ContractBillingService`). El wizard manual de rango libre a nivel cliente **mantiene el comportamiento actual**.

## Especificación del algoritmo

### Conceptos

- **Ciclo N**: el que calcula `CicloFacturacion` (aniversario de `fecha_inicio`, clamp fin de mes). Bounds recortados a vigencia como hoy.
- **Ventana de cierre del ciclo N**: `[fin_ciclo − 5 días, fin_ciclo + dias_gracia días]`. El −5 alinea con `VisitService::MAX_DIAS_ADELANTO = 5` (D21).
- **Lectura de cierre del ciclo N**: la última lectura no facturada del contrato con `fecha` dentro de la ventana de cierre.
- **Última lectura facturada** (del contrato C): la de mayor `fecha` entre las lecturas de C presentes en `invoice_details` (join `readings` × `invoice_details` por `contrato_id`; tie-break por id de lectura). Si no existe ninguna, la base es `lectura_inicial` del pivot.
- **Multiplicador M-derivation**: `M = CicloFacturacion::cicloQueContiene(contrato, fecha_ultima_lectura_facturada)`; `multiplicador = N − M` (mínimo 1). Si no hay lecturas facturadas, `M = −1` → el multiplicador cubre desde el ciclo 0. Esta derivación **no requiere estado nuevo** y garantiza conservación global: cada factura con lecturas consume el allowance de los ciclos (M, N]; los ciclos a renta base no consumen nada.

### Regla por ciclo (solo rangos alineados a ciclo)

Al facturar/estimar el ciclo N de un contrato:

1. **Ventana de lecturas**: lecturas no facturadas del contrato con `fecha > fecha_última_lectura_facturada` (sin cota inferior si no hay) y `fecha ≤ cierre` (ver 2).
2. **¿Existe lectura de cierre?** (en ventana `[fin−5, fin+gracia]`):
   - **Sí (ciclo medido)**: se facturan TODAS las lecturas no facturadas con `fecha ≤ fecha_de_la_lectura_de_cierre` (incluye lecturas tempranas del propio ciclo, p. ej. una del día 1-sep). `páginas = Σ paginas_periodo`. `allowance = multiplicador × paginas_incluidas`. `monto = tarifa_base + max(0, páginas − allowance) × costo_pag_excedente`. Detalles por lectura como hoy (distribución proporcional, redondeo absorbido en la última fila, `lectura_id` reservado).
   - **No (ciclo a renta base)**: NO se factura ninguna lectura (las tempranas fuera de ventana ruedan al siguiente ciclo medido). Un único detalle `lectura_id = null, paginas_consumidas = 0, monto = tarifa_base` (ya existe hoy, línea `InvoiceCalculationService.php:177-186`).
3. **Lecturas no facturadas con `fecha ≤ fecha_última_facturada`** (edge raro: registros de campo regularizados tarde): se excluyen del cálculo y generan advertencia.
4. **Orden de facturación libre**: si se factura el ciclo N antes que el N−1 (sin solapamiento, D20 lo permite), el N−1 quedará a renta base si sus lecturas ya fueron consumidas por el N — correcto por la derivación M. Sin restricción de orden.

### Casos gemelos que esto corrige (hoy sobrecobran)

- Lectura de hueco (saltó un ciclo) comparada contra 1× paquete.
- Lectura tardía del ciclo anterior (p. ej. 25-sep para corte 19-sep) que cae en la ventana del ciclo siguiente y recibe su paquete único.

## Tareas

### T1 — Migración `dias_gracia`

Nueva migración:
- `contracts.dias_gracia`: cambiar default a 7.
- `UPDATE contracts SET dias_gracia = 7 WHERE dias_gracia IS NULL OR dias_gracia = 0`.

### T2 — Support: ventana de cierre

En `backend/app/Support/CicloFacturacion.php` (o clase nueva `App\Support\CierreCiclo` si se prefiere, pero CicloFacturacion es "la única fuente de la aritmética de ciclos" según D17 — recomendado extenderla):

- `const DIAS_ANTES_CORTE = 5;`
- `ventanaCierre(Contract $c, Carbon $finCiclo): array{desde: Carbon, hasta: Carbon}` → `[fin−5, fin + max(1, dias_gracia)]` (dias_gracia ya ≥1 tras T1; defensivo).
- `esRangoAlineadaACiclo(Contract $c, Carbon $inicio, Carbon $fin): bool` → true si `esInicioDeCiclo($c, $inicio)` y `[inicio, fin]` == `bounds($c, cicloQueContiene($c, $fin))` (comparación a día).

### T3 — Motor: `InvoiceCalculationService::calcularEstimacion`

Cuando `$contratoId !== null` y el rango es ciclo-alineado (T2), sustituir la lógica de lecturas para ese contrato:

1. Derivar `últimaLecturaFacturada` (query a `invoice_details` join `readings`, excluyendo `$excluirFacturaId` — importante para `recalcular`, que borra sus detalles antes de llamar y ya queda fuera naturalmente).
2. Calcular multiplicador M-derivation (spec arriba).
3. Ventana de lecturas extendida (spec arriba) en lugar de `whereBetween(fecha, [periodoInicio, periodoFin])`.
4. Decisión medido/renta-base por existencia de lectura de cierre.
5. Allowance efectivo: agregar parámetro opcional a `Contract::calculateEstimatedAmount(int $pages, ?int $paginasIncluidasEfectivas = null)` (default null = comportamiento actual 1×; así no rompe otros callers).
6. Nuevas **advertencias** (no bloqueantes):
   - Ciclo a renta base: `"Ciclo sin lectura de corte: se cobra solo la renta base; el consumo se acumula al siguiente ciclo con lectura de corte."`
   - Multiplicador > 1: `"Periodo acumulado: %d ciclo(s) × %d páginas incluidas = %d."`
   - Lecturas huérfanas previas a la última facturada (punto 3 de la spec).
7. Nuevos campos en `contratos[]` del resultado: `ciclos_acumulados` (multiplicador), `paginas_incluidas_efectivas`, `es_ciclo_alineado` (bool), `lectura_cierre_fecha` (string|null).

**No cambiar** el comportamiento del wizard libre (`$contratoId === null` o rango no alineado): `whereBetween` actual, 1× paquete, advertencias existentes.

### T4 — `ContractBillingService::estimadoDelCiclo` + `periodosPendientes`

Los pendientes deben estimar igual que el batch (punto de evaluación del PROJECT.md: "¿la estimación coincide con lo cobrado?"):

- Iterar ciclos 0..último en orden (ya lo hace) **hilando estado de simulación**: una `fechaUltimaFacturadaVirtual` que arranca con la real y avanza cuando un ciclo pendiente estimado es "medido" (su lectura de cierre pasa a ser la base del siguiente). Sin esto, dos ciclos pendientes consecutivos contarían las mismas lecturas.
- Excluir advertencias de solape como hoy; incluir las nuevas advertencias de arrastre.
- Agregar al item de pendiente: `ciclos_acumulados`, `paginas_incluidas_efectivas`, `lectura_cierre_fecha`.
- Ciclo parcial final (FINALIZADO): allowance completo (decisión 3) — sale natural de la fórmula (multiplicador por ciclos, no por días).

### T5 — `InvoiceService`: verificar, no estructural

- `createDraftBatch`: ya itera cronológico en una transacción; la derivación por factura persistida hace el arrastre secuencial casi gratis. Verificar que el guard de monto 0 no regrese en ciclos a renta base con `tarifa_base = 0` (ese ciclo queda no seleccionable en UI, como hoy con `sinMonto`).
- `recalcular`: debe "upgradear" un borrador a renta base cuando llega la lectura de cierre (deriva de estado, funciona sin cambios extra — cubrir con test S7).
- `validarPeriodoNoDuplicado` / D20 / índice único de `lectura_id`: sin cambios (ciclos a renta base reservan con `lectura_id = null`; el ciclo medido factura lecturas posiblemente anteriores a su `periodo_inicio` — no afecta índice ni solape de periodos).

### T6 — Frontend `ContractDetail.tsx`

- Modal "Generar facturas del contrato" (líneas ~1245-1292): por cada pendiente, si `ciclos_acumulados > 1` mostrar Badge/info: `"Acumulado ×N · paquete {paginas_incluidas_efectivas} · consumo desde {lectura_cierre… o última facturada}"`. Si el ciclo es renta base con arrastre, texto suave explicando que solo cobra renta.
- Pestaña de facturación (facturados): no requiere cambio (el monto ya lo trae el detalle).
- Si el wizard de contrato (`CreateContract`) expone `dias_gracia`, actualizar help text al significado nuevo ("días tras el corte del ciclo en que una lectura tardía aún cierra el ciclo"). Verificar con grep antes de tocar.

### T7 — Tests

Extender `backend/tests/Feature/InvoiceContractBillingTest.php` (reusar helpers existentes; contrato `fecha_inicio 2026-08-20`, tarifa 1000, 3000 incluidas, 0.10 excedente, gracia 7 donde aplique):

- **S1** — Salto + corte (caso canónico): lectura 20-oct valor 7000 (paginas_periodo 7000). Batch `[2026-08-20]` → 1000 base. Batch `[2026-09-20]` → 1000 + 1000×0.10, allowance 2×3000.
- **S2** — Salto sin excedente: consumo acumulado 5000 ≤ 6000 → segundo ciclo solo renta base.
- **S3** — Lectura tardía dentro de gracia: corte 19-sep, lectura 22-sep (gracia 7) → pertenece al ciclo 0 (medido, 1× paquete), no al ciclo 1.
- **S4** — Lectura tardía fuera de gracia: lectura 29-sep → ciclo 0 a renta base; ciclo 1 factura lecturas 29-sep + 19-oct con 2× paquete (conservación: Σ paginas_periodo = hueco completo).
- **S5** — Lectura temprana no cierra: lectura 1-sep (fuera de [14-sep, 26-sep]) → ciclo 0 renta base; ciclo 1 la factura junto a la de corte con 2×.
- **S6** — Cierre normal: lectura 17-sep (dentro de [14-sep, 26-sep]) → ciclo 0 medido 1× (regresión del comportamiento esperado).
- **S7** — `recalcular` upgradea: crear borrador renta base → llega lectura de corte → `recalcular` → detalle con lectura y monto medido.
- **S8** — Estimación == cobrado: `estadoFacturacion` pendientes del escenario S1 (antes de facturar) muestra el mismo monto/allowance que luego produce el batch (con el hilado de simulación de T4).
- **S9** — Arrastre dentro del mismo batch: batch `[2026-08-20, 2026-09-20]` sin lectura en ciclo 0 y con corte en ciclo 1 → primer borrador renta base, segundo con 2×.
- **S10** — Wizard libre sin cambios (regresión): `calcularEstimacion` sin `contrato_id` sobre rango de 2 meses mantiene 1× y su advertencia multi-mes.
- **S11** — Multi-impresora: dos impresoras, una lectura cada una en el hueco → Σ correcta, allowance único por contrato.
- **S12** — Primer ciclo desde `lectura_inicial`: sin lecturas facturadas previas, corte del ciclo 0 → multiplicador 1.
- **S13** — FINALIZADO parcial: `fecha_fin` a mitad del ciclo con arrastre abierto → allowance completo del multiplicador.
- **S14** — Migración: contrato con `dias_gracia = 0` pre-existente queda en 7 tras `migrate`.

### T8 — Documentación `PROJECT.md`

- Nueva decisión **D22** ("Arrastre de consumo por ciclos sin lectura de corte"): ventana `[fin−5, fin+dias_gracia]`, M-derivation, renta base sin consumo de allowance, alcance solo ciclo-alineado, sin prorrateo en ciclo parcial.
- Nota en D17 de la semántica nueva: una factura puede incluir lecturas con `fecha < periodo_inicio` (la lectura mide el hueco, el periodo facturado sigue siendo el ciclo).
- Actualizar `dias_gracia` en glosario/§12 mapa de evidencia (nueva lógica en `CicloFacturacion`/`InvoiceCalculationService`).

## Invariantes y decisiones preservadas (checklist de revisión)

- D1 (cálculo en servidor) ✅ — todo el arrastre vive en el motor.
- D17/D18 ✅ — el ciclo sigue siendo la unidad; una factura por ciclo con su `tarifa_base`; el arrastre suma páginas y paquete, nunca renta.
- D20 e índice `lectura_id` ✅ — sin cambios; ciclos a renta base reservan con `lectura_id = null`.
- Conservación global: Σ allowance consumidos = Σ ciclos con lectura facturada; cada lectura a lo sumo una factura.
- Drift aceptado (documentado): lecturas de cierre con ±gracia/−5 de desfase pueden apretar/aflojar un allowance individual, nunca el total de vida del contrato.

## Validación

```bash
docker compose exec app php artisan migrate
docker compose exec app php artisan test --filter=InvoiceContractBillingTest
docker compose exec app php artisan test                      # suite completa
docker compose run --rm --no-deps frontend sh -c "npm run build"   # tras T6; recargar 8080 con Ctrl+F5
```

## Fuera de alcance (explícito)

- Wizard manual de rango libre a nivel cliente (mantiene comportamiento actual y sus advertencias).
- Prorrateo de paquete/tarifa en ciclos parciales (D17 se mantiene).
- Cambios en móvil (la semántica de captura no se toca).
- Reportes/caja/rentabilidad (siguen bucketizando por mes calendario, como D17 ya documenta).
