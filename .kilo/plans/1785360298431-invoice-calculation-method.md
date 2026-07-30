# Plan: Funcionalidad real del campo "Método de cálculo" en Registrar Factura

## Objetivo
Dar funcionalidad al campo **Método de cálculo** (`/finanzas/facturas/registrar`) en `RegisterInvoicePage.tsx`:
- **Según lecturas registradas (recomendado)**: el sistema calcula el `monto_total` en automático desde las lecturas del cliente en el periodo, aplicando la fórmula del contrato. El campo "Monto total *" queda **solo lectura** (bloqueado).
- **Monto manual**: el campo "Monto total *" se habilita para que el usuario lo teclee.

Hoy el radio y `monto_total` son independientes y `metodo_calculo` nunca se envía al backend (estado muerto). Este plan conecta todo.

## Decisions (resueltas)

1. **Cálculo en backend** — nuevo endpoint reutiliza `Contract::calculateEstimatedAmount()`. El frontend solo muestra resultados. (Aprobado)
2. **Lecturas a usar (camino robusto, sin migración)**: lecturas con `fecha ∈ [periodo_inicio, periodo_fin]` del cliente, **excluyendo las ya referenciadas en `invoice_details.lectura_id`**. Robusto y auto-reparable: al borrar una factura, el cascade-delete de `invoice_details` libera sus lecturas automáticamente. No se añade columna `facturada`.
3. **Monto bloqueado en modo lecturas** — read-only. (Aprobado)
4. **Granularidad de `invoice_details`** (decidido para compatibilidad + economía + prevención de doble facturación):
   - Una fila por **lectura** (para enlazar `lectura_id` → habilita la exclusión de lecturas ya facturadas y trazabilidad por impresora).
   - `monto_calculado` de cada fila de lectura = **proporcional** a sus páginas (`monto_contrato × pages_reading / total_pages`).
   - **Fila de "renta base"** por contrato cuando `total_pages == 0` pero `tarifa_base > 0` (contrato de renta fija sin consumo): `{ contrato_id, impresora_id=null, lectura_id=null, paginas_consumidas=0, monto_calculado=tarifa_base }`.
   - Σ `monto_calculado` = `monto_total` exacto (ajuste de redondeo en la última fila de cada contrato).

## Fórmula de cálculo (ya existe en el modelo)
`Contract::calculateEstimatedAmount(totalPages)`:
```
excess = max(0, totalPages - paginas_incluidas)
monto_contrato = tarifa_base + (excess * costo_pag_excedente)
```
Agregación: las páginas se **suman por contrato** (no por impresora/lectura), porque `tarifa_base` y `paginas_incluidas` son por contrato.

## Data flow
```
Frontend (lecturas mode) 
  → GET /v1/invoices/calcular?cliente_id&periodo_inicio&periodo_fin
  → Backend: lee contratos ACTIVOS del cliente + sus lecturas en rango (no facturadas)
            → agrupa por contrato, aplica fórmula, arma `detalles[]`
  ← { monto_total, contratos[], detalles[], advertencias[] }
Frontend rellena monto_total (read-only) + tabla de desglose (paso 2)
  → POST /v1/invoices { ...datos, monto_total, detalles[] }   (detalles ya validados por StoreInvoiceRequest)
```

---

## Tareas

### Backend

#### 1. Nuevo método de cálculo en `InvoiceService` (o nuevo `InvoiceCalculationService`)
- ` calcularEstimacion(int $clienteId, string $periodoInicio, string $periodoFin): array`
- Pasos:
  1. `Contract::where('cliente_id', $clienteId)->where('estado', ACTIVO)->get()` (con `printers` activas cargadas).
  2. IDs de impresoras activas de esos contratos.
  3. `Reading::whereIn('impresora_id', $idsImpresoras)->whereBetween('fecha', [$ini, $fin])`.
  4. **Excluir ya facturadas**: `->whereNotIn('id', DB::table('invoice_details')->select('lectura_id')->whereNotNull('lectura_id'))`.
  5. Agrupar lecturas por `contrato_id`. Para contratos con `lectura_id` null (sin contrato asignado) → listar en `advertencias[]` como "lectura sin contrato" y excluir del monto.
  6. Por contrato: `totalPages = Σ paginas_periodo`; `montoContrato = $contract->calculateEstimatedAmount($totalPages)`.
  7. Construir `detalles[]`:
     - Si `totalPages > 0`: una fila por lectura con `monto_calculado` proporcional (redondeo en la última).
     - Si `totalPages == 0 && tarifa_base > 0`: fila de renta base.
  8. `monto_total = Σ montoContrato`.
- Devuelve `{ monto_total, contratos:[{contrato_id,codigo,tarifa_base,paginas_incluidas,costo_pag_excedente,total_paginas,monto_contrato,lecturas:[...]}], detalles[], advertencias[] }`.

#### 2. Endpoint en `InvoiceController`
- `public function calcular(Request $request): JsonResponse` → valida `{ cliente_id (required|exists:clients,id), periodo_inicio (required|date), periodo_fin (required|date|after_or_equal:periodo_inicio) }` y llama al service.
- **GET** `v1/invoices/calcular` (idempotente, solo lectura).

#### 3. Ruta en `routes/api.php`
- Dentro del grupo `permission:finanzas.facturas`:
  `Route::get('invoices/calcular', [InvoiceController::class, 'calcular']);`
- Colocarla **antes** de `Route::apiResource('invoices', ...)` para que `/calcular` no colisione con `/{invoice}`.

#### 4. (Sin cambios) `StoreInvoiceRequest` ya valida `detalles.*` (contrato_id, impresora_id, lectura_id, paginas_consumidas, monto_calculado) e `InvoiceService::create` ya persiste `detalles`. Confirmar que `lectura_id`/`contrato_id`/`impresora_id` permitidos (ya lo están).

### Frontend

#### 5. Tipo + hook en `frontend/src/hooks/useInvoices.ts`
- Tipo `InvoiceCalculation` (monto_total, contratos[], detalles[], advertencias[]).
- `useInvoiceCalculation()` con `useQuery` habilitado solo cuando `metodo_calculo==='lecturas' && cliente_id && periodo_inicio && periodo_fin`. QueryKey `['invoice-calc', cliente_id, periodo_inicio, periodo_fin]`.

#### 6. `RegisterInvoicePage.tsx` — Paso 1 (Datos Generales)
- El radio **controla el comportamiento** (no solo estado muerto):
  - `lecturas`: el input "Monto total *" queda `disabled`/`readOnly` y muestra `calculo?.monto_total ?? 0`. Se rellena solo al tener cliente + periodo_inicio + periodo_fin.
  - `manual`: el input "Monto total *" habilitado y vacío (editable).
- Al cambiar a `lecturas`, si falta cliente o periodo → mostrar aviso "Selecciona cliente y periodo para calcular".
- Mostrar `advertencias[]` del cálculo (p. ej. lecturas sin contrato, sin lecturas en el periodo).

#### 7. `RegisterInvoicePage.tsx` — Paso 2 (Impresoras y Contratos) — hoy es stub
- Reemplazar el placeholder por una **tabla de desglose** con `calculo.contratos[]`: código de contrato, páginas consumidas (total_paginas), tarifa base, costo/página, monto del contrato.
- Si no hay cálculo (modo manual o sin datos), mostrar estado vacío coherente.

#### 8. `RegisterInvoicePage.tsx` — Paso 3 (Revisión) y `handleCreateInvoice`
- En el resumen, si modo `lecturas`, mostrar el desglose y el monto calculado (read-only).
- En `handleCreateInvoice`: cuando `metodo_calculo==='lecturas'`, enviar `detalles: calculo.detalles` y `monto_total: calculo.monto_total`. Cuando `manual`, enviar solo `monto_total` (sin detalles). **Enviar siempre `monto_total`** (es `required` en backend).
- Validar que en modo `lecturas` exista un cálculo con `monto_total` antes de habilitar "Registrar Factura".

#### 9. Botón "Siguiente" del paso 1
- Añadir validación de `fecha_vencimiento` (obligatoria en backend) a la condición `disabled`. Para modo `lecturas`, también requerir que el cálculo haya cargado (cliente + periodos).

---

## Casos límite / Edge cases (a manejar)
- **Sin lecturas en el periodo** y contrato de renta fija → `tarifa_base` como fila base; monto > 0. OK.
- **Sin lecturas y contrato puro consumo** (`tarifa_base=0`) → monto 0. Aviso al usuario; permitir pasar a manual.
- **Sin contratos activos** → monto 0 + advertencia; recomendar modo manual.
- **Lecturas ya facturadas** → se excluyen solas (no se duplican).
- **Período sin `periodo_fin`** → el cálculo no corre hasta tener ambos (el hook no se habilita).
- **Cliente con varios contratos** → se factura cada contrato por separado y se suman.
- **Impresora activa con lectura cuyo `contrato_id` es null** → va a advertencias, fuera del monto.

## Riesgos
- **Race condition doble facturación**: dos usuarios creando facturas del mismo periodo podrían consumir las mismas lecturas si calculan casi a la vez. Mitigación: el `POST /invoices` debe re-validar en el servicio que ninguna `lectura_id` de `detalles` ya exista en `invoice_details` antes de crear (transacción + chequeo). Añadir este chequeo en `InvoiceService::create`.
- **Redondeo**: la suma de `monto_calculado` de las filas debe igualar `monto_total` exacto (absorber céntimos en la última fila de cada contrato).

## Validation plan
- Backend: `php artisan test` (añadir test del `calcular`: cliente con lecturas en rango, cliente sin lecturas, lecturas ya facturadas se excluyen, varios contratos).
- Probar en Docker: tras editar backend, `docker compose exec app php artisan config:cache` y `php artisan route:clear`.
- Frontend: tras editar, `docker compose run --rm --no-deps frontend sh -c "npm run build"` y recargar 8080 con Ctrl+F5.
- Escenarios manuales: (a) modo lecturas con datos → monto se rellena y bloquea, detalles se guardan; (b) modo manual → monto editable; (c) registrar el mismo periodo dos veces → la segunda vez monto 0 (lecturas ya consumidas).

## Out of scope
- Edición de facturas con recálculo (el `update` actual solo permite `notas`).
- Vista de detalle de factura mostrando el desglose de `invoice_details` (mejora futura de UI).
- Marca explícita `facturada` en `readings` (innecesaria con el enfoque de `lectura_id`).
