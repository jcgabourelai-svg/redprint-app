# Plan: Facturación por contrato con periodos fijos + corrección de hallazgos

> Objetivo: (1) corregir los hallazgos de integridad detectados (tab decorativo, `contrato_id`
> nulo, ingresos/rentabilidad mentirosos), (2) implementar la generación de facturas desde el
> contrato con **periodos fijos mensuales** y **selección múltiple de periodos saltados**
> (un borrador por periodo). Todo el cálculo de dinero permanece 100% en servidor (D1).

## Hallazgos que este plan resuelve (con evidencia)

| # | Hallazgo | Evidencia |
|---|---|---|
| A | Tab "Facturas Asociadas" hardcodeado, sin backend | `frontend/src/pages/contracts/ContractDetail.tsx:685-695`; `ContractResource` no expone facturas |
| B1 | `createDraft` y CFDI dejan `contrato_id = null`; solo seeders lo llenan | `backend/app/Services/InvoiceService.php:94`, `CfdiService.php:176`, `InvoiceSeeder.php:40,65` |
| B2 | `Contract::ingresos` suma por encabezado → 0 en datos reales; `ContractResource:39` lo sobreescribe con un *estimado* y lo etiqueta "Ingresos" | `backend/app/Models/Contract.php:107-110`, `ContractResource.php:39-44` |
| B3 | `ProfitabilityService` y `FinanceReportController` joinean `invoices.contrato_id` → ingresos 0 en datos reales | `ProfitabilityService.php:30-38`, `FinanceReportController.php:71-73` |
| C | Solapamiento de periodos: solo advertencia, bloqueo "Fase 1" pendiente | `InvoiceService.php:159,204-221` |
| D | Periodo de facturación = rango libre tecleado a mano; sin noción de "periodos pendientes" | `RegisterInvoicePage.tsx:227-244`, `InvoiceCalculationService.php:23-28` |

## Decisiones de diseño (registrar como ADRs ligeros en PROJECT.md al final)

- **D17 — Periodos fijos mensuales (mes calendario)** para borradores: `Y-m`, bounds
  derivados (`periodo_inicio`/`periodo_fin` ya existen; **no** se agrega columna `periodo`,
  se deriva de `periodo_inicio`). Racional: tarifa base mensual, `PeriodClose` mensual, CFDI
  mensual, detección trivial de pendientes. Rangos libres quedan **solo** para captura directa
  de factura ya timbrada en PAC (evidencia fiscal, no cálculo del sistema).
- **D18 — Periodos saltados → un borrador por periodo, nunca fusionados.** Una factura que
  abarque N meses daría al cliente **una sola** dotación de `paginas_incluidas` y **una sola**
  `tarifa_base` (la fórmula no escala por duración del rango). Un borrador por periodo
  preserva la semántica mensual del contrato.
- **D19 — Ingresos por contrato = cobrado atribuido vía `invoice_details`**: si la factura es
  mono-contrato (`contrato_id` en encabezado) atribuye `monto_pagado` completo; si es
  multi-contrato (agrupada por cliente), atribuye `monto_pagado × (Σ detalles del contrato /
  monto_total)`. El encabezado `contrato_id` se llena cuando el borrador es de un solo
  contrato (explícito o auto-derivado).
- **D20 — Bloqueo duro de periodo duplicado** en `createDraft`/batch/`emitir` (mismo cliente +
  rangos que se intersectan + alcance de contrato solapado). La **captura directa** (`create`,
  PAC externo) mantiene solo advertencia: registra un hecho fiscal ya existente.

## Reglas de negocio clave

1. **Cobertura de periodo facturado**: un mes `Y-m` está cubierto si existe factura
   (cualquier estado, los borradores también reservan) del cliente cuyo
   `[periodo_inicio, periodo_fin]` intersecta el mes Y (factura.contrato_id == contrato.id
   OR la factura tiene detalles con contrato_id == contrato.id). Conservador: intersección,
   no igualdad (protege contra rangos libres históricos).
2. **Periodos pendientes** de un contrato: meses desde `max(fecha_inicio, mes siguiente al
   último cubierto)` hasta el mes actual (o hasta el mes de `fecha_fin` si el contrato
   FINALIZÓ). Mes actual: seleccionable con advertencia "periodo en curso, lecturas
   incompletas".
3. **Primer periodo parcial**: `periodo_inicio = max(primer día del mes, fecha_inicio)`.
   Último periodo si el contrato terminó a mediaos: `periodo_fin = min(fin de mes, fecha_fin)`.
4. **Batch all-or-nothing**: la creación de N borradores es UNA transacción; si un periodo
   falla (p. ej. monto 0), se aborta todo con mensaje que identifique el periodo fallido.
5. **Auto-derivación de `contrato_id`**: si el cálculo del borrador cubre exactamente 1
   contrato activo, el encabezado se llena con él (independiente de quién lo pidió).

---

## FASE 0 — Corregir ingresos/rentabilidad por contrato (Hallazgos B2/B3)

*Independiente, máximo valor (dinero). Sin cambios de API visibles salvo valores correctos.*

- [x] **0.1** `Contract::getIngresosAttribute` (`backend/app/Models/Contract.php`):
      reemplazar `$this->invoices()->sum('monto_pagado')` por atribución vía detalles según
      regla D19. Implementación eficiente (2 queries agrupadas, no por-factura):
      1. Facturas del cliente con `contrato_id = id` OR `whereHas('details', contrato_id = id)`
         Y `estado != BORRADOR`, seleccionando `id, contrato_id, monto_pagado, monto_total`.
      2. `invoice_details` de esas facturas con `contrato_id = id` agrupados por `factura_id`
         sumando `monto_calculado`.
      3. En PHP: mono-contrato → `monto_pagado`; multi → `monto_pagado * (share/monto_total)`
         con guard `monto_total > 0` (si 0, aporta 0).
- [x] **0.2** `ContractResource::toArray` (`ContractResource.php:39-44`): dejar de
      sobreescribir `ingresos`/`costos`/`rentabilidad`/`margen` con el estimado. Exponer
      además `estimado_periodo_total` (el `estimadoTotal` actual) como campo propio. El
      estimado por impresora (`estimado_del_periodo`) se mantiene para el tab Impresoras
      (etiquetado correctamente como estimado).
- [ ] **0.3** `ContractDetail.tsx` tab Rentabilidad (~líneas 696-753): usar los valores reales
      (`contract.ingresos` = cobrado) y añadir una línea secundaria
      "Estimado del periodo actual: {estimado_periodo_total}". Los per-printer
      `rentabilidad_acumulada` del desglose se quedan como estimado (re-etiquetar a
      "Rentabilidad estimada" para no mentir).
- [x] **0.4** `ProfitabilityService::perPrinter` (`ProfitabilityService.php:30-38`):
      calcular ingresos desde `invoice_details` join `invoices`
      (`whereBetween('invoices.periodo_inicio', …)`, `estado != BORRADOR`,
      `SUM(invoice_details.monto_calculado)`) join `contract_printer` por
      `invoice_details.contrato_id` (mantener `activa = true`; limitación pre-existente:
      impresoras liberadas no atribuyen —documentar en el método). Nota semántica: pasa de
      `monto_total` (facturado por encabezado) a atribuido por detalles.
- [x] **0.5** `FinanceReportController` (líneas 71-73): misma corrección que 0.4 para
      ingresos por cliente (vía `invoice_details` de los contratos del cliente, mono o multi
      contrato).
- [x] **0.6** Tests (ver §Validación): atribución proporcional multi-contrato, mono-contrato,
      borradores excluidos, `monto_total = 0`.

## FASE 1 — Motor de cálculo por contrato + `contrato_id` en borradores (Hallazgos B1, D)

- [x] **1.1** `InvoiceCalculationService::calcularEstimacion`: nuevo parámetro
      `?int $contratoId = null`; filtrar la query de `$contratos` con
      `->when($contratoId, fn ($q) => $q->where('id', $contratoId))`. Todo lo demás
      (exclusión de lecturas facturadas, distribución, advertencias) queda igual.
- [x] **1.2** Guarda en servicio: si `contratoId` no pertenece a `clienteId` o no está
      ACTIVO → `BusinessRuleException` (422). Mensaje en español del dominio.
- [x] **1.3** `InvoiceController::calcular`: aceptar `contrato_id` opcional
      (`nullable|exists:contracts,id`) y pasarlo al servicio.
- [x] **1.4** `StoreInvoiceDraftRequest`: agregar `'contrato_id' => 'nullable|exists:contracts,id'`.
- [x] **1.5** `InvoiceService::createDraft`: recibir `contrato_id`; validar pertenencia al
      cliente + ACTIVO (misma guarda que 1.2); setear en el `Invoice::create`. Auto-derivación
      D19: si no vino `contrato_id` y `$calc['contratos']` tiene exactamente 1 elemento →
      setearlo. Incluir `contrato_id` en la respuesta (ya viene por `InvoiceResource`).
- [x] **1.6** `recalcular`: conservar el `contrato_id` existente del borrador y re-limitar el
      cálculo a ese contrato cuando esté seteado (un borrador mono-contrato no debe mutar a
      multi-contrato al recalcular).
- [ ] **1.7** Frontend `useInvoices.ts`: extender el tipo de `useCreateInvoiceDraft` con
      `contrato_id?: number`; `useInvoiceCalculation` con `contrato_id` opcional en params.
- [x] **1.8** Tests: filtro por contrato, 422 por contrato ajeno/inactivo, seteo explícito y
      auto-derivado, recálculo conservando alcance.

## FASE 2 — Estado de facturación del contrato (endpoint de periodos)

- [x] **2.1** Nuevo servicio `backend/app/Services/ContractBillingService` con
      `estadoFacturacion(Contract $contrato): array`:
      - `facturados`: facturas del cliente que tocan el contrato (regla de cobertura 1),
        con `{factura_id, numero_factura|null, estado, periodo_inicio, periodo_fin, periodo
        (Y-m derivado), monto_contrato (Σ detalles del contrato en esa factura),
        monto_total}`. Ordenadas por periodo desc. Excluir nada: borradores incluidos y
        marcados (reservan).
      - `pendientes`: meses según regla 2/3, cada uno con
        `{periodo, periodo_inicio, periodo_fin, lecturas: n, paginas: n, monto_estimado,
        advertencias: [], actual: bool}`. Cálculo por mes reutilizando
        `calcularEstimacion(cliente, inicioMes, finMes, contratoId)` en loop (N ≤ ~24,
        endpoint de admin, aceptable).
      - `ultimo_periodo_cubierto`: `Y-m|null`.
      - Contrato no ACTIVO → `pendientes` solo hasta `fecha_fin` (FINALIZADO) o vacío
        (CANCELADO/SUSPENDIDO: no generar, pero listar facturados).
- [x] **2.2** Ruta + controlador: `GET /contracts/{contract}/facturacion` en el grupo
      `permission:finanzas.facturas` de `routes/api.php` (expone datos de dinero; el botón
      de generar también requiere ese permiso). Método delgado en `ContractController`
      (o `InvoiceController@estadoFacturacionContrato`) que delega al servicio.
- [x] **2.3** Tests: mes cubierto por factura multi-contrato (por detalles), por mono-contrato
      (por encabezado), intersección de rangos libres, primer periodo parcial, mes actual
      marcado `actual`, FINALIZADO truncado a `fecha_fin`.

## FASE 3 — Periodos fijos: batch de borradores + bloqueo duro de duplicados (Hallazgos C)

- [x] **3.1** `StoreInvoiceDraftBatchRequest` nuevo:
      `cliente_id` required, `contrato_id` required (el batch es siempre por contrato),
      `periodos` required array min:1 max:24 de strings `date_format:Y-m` distintos y no
      futuros, `notas` nullable.
- [x] **3.2** `InvoiceService::createDraftBatch(array $data, User $creator): array`:
      UNA `DB::transaction` que por cada periodo calcula bounds (regla 3), llama a la lógica
      de `createDraft` (refactor: extraer método privado `crearBorradorInterno(cliente,
      periodoInicio, periodoFin, contratoId, notas, creator)` reutilizado por ambos flujos)
      y colecciona `[{invoice, advertencias}]`. All-or-nothing (regla 4): cualquier 422 aborta
      todo con mensaje "El periodo 2026-06 no genera monto…" identificado. Orden cronológico.
- [x] **3.3** Bloqueo duro de duplicado (regla D20) en `crearBorradorInterno` y en `emitir`
      (excluyéndose a sí mismo, dentro del lock existente): query de facturas del cliente con
      `periodo_inicio <= fin && periodo_fin >= inicio` Y alcance solapado
      (`contrato_id` igual, o `whereHas('details', contrato_id)` igual, o target sin contrato
      = cualquier factura del cliente) → `BusinessRuleException` citando
      numero_factura/“borrador #id” y el periodo. Reemplaza el comentario "Fase 1" en
      `InvoiceService.php:159`. La advertencia de `calcularEstimacion` se mantiene (preview).
      `create` directa NO se bloquea (solo advertencia existente).
- [x] **3.4** Ruta: `POST /invoices/draft-batch` en el grupo `finanzas.facturas`, antes del
      apiResource (igual que `/draft`). Respuesta 201 con
      `{data: [InvoiceResource…], advertencias: {periodo: […]}}`.
- [ ] **3.5** Wizard `RegisterInvoicePage.tsx` modo borrador: reemplazar los dos inputs de
      fecha por un **selector de mes** (`<Input type="month">` o Select de meses) que deriva
      `periodo_inicio`/`periodo_fin` (bounds de mes calendario). Modo directa (PAC): se
      mantienen los rangos libres. Nota de ayuda: "Los borradores se facturan por mes
      calendario". (Opcional si hay tiempo: mostrar el listado de meses ya facturados del
      cliente vía un `GET /invoices?cliente_id=` previo — NO bloqueante.)
- [x] **3.6** Tests: batch de 3 periodos saltados crea 3 borradores cada uno con SOLO sus
      lecturas (invariante única preservada); renta fija sin lecturas → 3 líneas de tarifa
      base (una por borrador); duplicado por factura multi-contrato existente → 422 nombrando
      el periodo; `emitir` bloqueado por factura emitida posterior; directa con solape → 201
      (solo advertencia); fallo en un periodo del batch → rollback total y mensaje con el
      periodo.

## FASE 4 — Frontend: tab real de facturas + generación desde contrato (Hallazgo A)

- [ ] **4.1** Hooks nuevos en `frontend/src/hooks/useInvoices.ts` (o `useContracts.ts`):
      `useContractBilling(contratoId)` → `GET /contracts/{id}/facturacion`;
      `useCreateInvoiceDraftBatch()` → `POST /invoices/draft-batch`, invalidando
      `['invoices']` y `['contract-billing', id]` y `['contracts']`.
- [ ] **4.2** `ContractDetail.tsx` — tab "Facturas Asociadas" real:
      - Cargar `useContractBilling` (habilitado si el usuario tiene permiso
        `finanzas.facturas`; si no, tab con mensaje "Sin permiso de facturas").
      - Lista de `facturados`: folio o "Borrador #id", periodo `Y-m`, Badge de estado
        (`InvoiceStatusLabels`), monto del contrato (formatCurrency). Click de fila →
        `/finanzas/facturas/{id}`.
      - Empty state con CTA "Generar factura" si hay pendientes.
- [ ] **4.3** Botón **"Generar factura"** en el tab (o header del tab): visible si
      `isAdmin && contract.estado === 'ACTIVO' && pendientes.length > 0`. Abre `Modal`
      (patrón del proyecto, no wizard: selección simple) con:
      - Checkbox list de `pendientes`: label "Agosto 2026", lecturas, páginas, monto
        estimado (formatCurrency), icono AlertTriangle + tooltip si `advertencias`.
        Default: todos los periodos **pasados** pre-seleccionados; el actual sin marcar.
        Badge "en curso" para `actual: true`.
      - Resumen: "N borradores · Total estimado $X".
      - Copy de confirmación honesto: "Se crearán N borradores (uno por periodo). Cada
        borrador reserva las lecturas de su periodo y no es cuenta por cobrar hasta emitirse
        con el folio del PAC. No se fusionan periodos: cada mes conserva su pages incluidas
        y su tarifa base."
      - Al éxito: Toast "N borradores creados", refrescar billing/contract, navegar al
        detalle del primer borrador (o quedarse — decisión: navegar al más reciente).
- [ ] **4.4** Tipos: extender `frontend/src/types/invoice.ts` / `contract.ts` con las shapes
      del endpoint (`ContractBillingStatus`, `PendingPeriod`, `BilledInvoice`). Sin textos en
      inglés (D10), tildes correctas.
- [ ] **4.5** La advertencia del mes actual y el caso "sin lecturas y tarifa 0" del endpoint
      deben reflejarse en la UI (deshabilitar ese checkbox con explicación si
      `monto_estimado <= 0`, porque el batch abortaría).

## FASE 5 — Backfill opcional de datos

- [ ] **5.1** (Opcional, seguro) Comando artisan o migración de datos: setear
      `invoices.contrato_id` cuando NULL y todos sus `invoice_details` apunten a un único
      contrato. Idempotente. Con Fase 0 los reportes ya no dependen del encabezado, así que
      esto es cosmético para consistencia. NO tocar facturas CFDI vinculadas.
- [ ] **5.2** Actualizar `PROJECT.md`: añadir D17-D20 a §8, actualizar §5 (entidad Invoice),
      §10 (quitar tab hardcodeado de la lista de mocks si aparece) y el mapa de evidencia §12.
      Actualizar `AGENTS.md` solo si cambia algo del flujo Docker (no debería).

---

## Casos límite a cubrir (tests o revisión manual)

1. Contrato inicia el 15 → primer periodo `2026-03-15..2026-03-31`.
2. Contrato FINALIZADO el 10 → último periodo truncado; sin botón generar (no ACTIVO).
3. Cliente con 2 contratos activos: borrador por contrato A no toca lecturas de B; wizard
   Finanzas sigue agrupando ambos (multi-contrato, `contrato_id` null).
4. Lecturas del contrato fuera de los periodos seleccionados → quedan pendientes; el
   endpoint las mostrará en periodos posteriores (no se pierden: índice único parcial).
5. Dos borradores del mismo contrato/mes → bloqueado por 3.3.
6. Factura directa PAC con rango solapado → permitida (evidencia fiscal), advertencia.
7. `recalcular` un borrador mono-contrato tras capturar más lecturas del mes.
8. Pago parcial en factura multi-contrato → atribución proporcional en `Contract::ingresos`.
9. Batch donde un mes no genera monto (tarifa 0 y sin lecturas) → rollback total + mensaje
   con el mes; la UI deshabilita ese mes (4.5).
10. Mes en curso seleccionado → advertencia "lecturas aún incompletas".

## Validación

```powershell
# Backend (por fase y al final)
docker compose exec app php artisan test --filter=InvoiceCalculationTest
docker compose exec app php artisan test --filter=InvoiceDraftTest
docker compose exec app php artisan test                      # suite completa
docker compose exec app php artisan migrate                   # si se added algo (solo datos: no hay DDL nuevo)

# Rutas nuevas -> refrescar caché si aplica
docker compose exec app php artisan config:cache

# Frontend
docker compose run --rm --no-deps frontend sh -c "npm run lint"
docker compose run --rm --no-deps frontend sh -c "npm run build"   # rebuild del dist (puerto 8080, Ctrl+F5)
```

- Tests nuevos a escribir (archivo nuevo `InvoiceContractBillingTest.php` siguiendo helpers
  de `InvoiceDraftTest`): casos 1-10 de arriba + los listados por fase.
- Verificación manual en `http://localhost:8080`: contrato con periodos saltados → generar
  2-3 borradores → emitir uno → verificar tab Facturas, Rentabilidad del contrato con
  ingresos reales, y reporte de rentabilidad (`/finanzas/rentabilidad`) ya no en 0.

## Orden de ejecución y dependencias

Fase 0 (independiente, hacer primero: es el bug de dinero) → Fase 1 (motor) → Fase 2
(usa 1.1) → Fase 3 (usa 1 y 2) → Fase 4 (usa 2 y 3) → Fase 5 (cierre documental).
Cada fase deja el sistema desplegable por sí sola.

## Fuera de alcance (explícito)

- Móvil (`/m/`): sin cambios.
- `dia_corte` configurable por contrato (los periodos son mes calendario; futuro).
- Bloqueo de solape en captura directa PAC (solo advertencia, por diseño D20).
- Timbrado/emisión CFDI hacia el SAT, CFDI de egreso.
- Optimizar N+1 de `Contract::$appends` en listados (pre-existente; la atribución de D19
  mantiene el mismo patrón de costo por contrato —documentado).
- Scheduler/recordatorios de facturación pendiente.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Endurecer solape rompe flujos con datos históricos de rangos libres | Regla conservadora de intersección; captura directa excluida del bloqueo; advertencia previa ya existe |
| Atribución proporcional cambia cifras que el usuario conocía (estimado → real) | Copy claro en tab Rentabilidad ("cobrado a la fecha") + estimado visible por separado |
| Batch parcial | All-or-nothing en una transacción; UI deshabilita meses sin monto |
| N+1 del endpoint `facturacion` con muchos periodos | Loop acotado (max 24 meses), endpoint admin, índice `invoices_cliente_periodo_index` ya existe |
| Fragmentación de folios PAC al facturar por contrato | Es decisión del operador: el wizard por cliente sigue disponible para agrupar contratos en un folio |
