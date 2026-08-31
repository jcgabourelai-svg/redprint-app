# Fase 2 — Facturas de doble propósito: BORRADOR calculado vs captura PAC + vencimiento derivado

> Agente implementador: lee `AGENTS.md` y `PROJECT.md` primero. Todo corre en Docker (puerto 8080);
> no usar `npm run dev` en el host. Al terminar cambios de frontend, recompilar el dist (ver §Verificación).

## Contexto y decisiones ya cerradas (no reabrir)

- La factura interna tiene **doble propósito**: (a) capturar una factura ya timbrada en el PAC externo
  (flujo directo, con folio), (b) **borrador** calculado por el sistema que luego se "emite" con el
  folio real. El borrador NO es cuenta por cobrar.
- `fecha_vencimiento` **deja de ser input libre**: la deriva el servidor como
  `fecha_emision + cliente.dias_credito` (default 30, editable en el cliente). La columna sigue
  existiendo (materializada al emitir), coherente con el trade-off de saldos derivados (PROJECT.md §3).
- El borrador **sí escribe `invoice_details` al crearse** → las lecturas quedan reservadas y el índice
  único parcial existente (`invoice_details_lectura_id_unique`) impide que otro borrador/factura las
  reclame. El borrador se **elimina (hard delete)**, no se cancela: sin folio, sin pagos, sin CFDI no
  hay historia que conservar. El cascade de `invoice_details` libera las lecturas.
- En esta fase el solapamiento de periodos **solo genera advertencia** en `/invoices/calcular`
  (detector global, severidad no bloqueante). Los bloqueos duros (crear/recalcular/emitir borrador)
  son la Fase 1 posterior — fuera de alcance.
- Ámbito de validación de solapamiento: **cliente** (el wizard factura todos los contratos activos
  del cliente en una sola factura).
- Sin permisos nuevos: todo bajo `permission:finanzas.facturas` existente (D9: reutilizar).
- Tercera vía de creación de factura: `CfdiService` crea facturas PENDIENTE directamente — ajustar
  su vencimiento también.

## Estado final de la máquina de Factura

```
BORRADOR --emitir(folio+fecha_emision)--> PENDIENTE --> PARCIALMENTE_PAGADA --> PAGADA
BORRADOR --recalcular--> BORRADOR (regenera detalles/monto)
BORRADOR --eliminar--> (hard delete, cascade detalles)
PENDIENTE --> VENCIDA (scheduler diario checkOverdue)
```

Reglas de guarda: pagos rechazados sobre BORRADOR; `emitir` exige folio único; CFDI auto-link por
serie+folio nunca matchea NULL (sin cambio necesario).

---

## Tareas (en orden)

### 1. Migraciones

1. `backend/database/migrations/2026_08_31_000000_make_invoice_emission_fields_nullable.php`
   - `invoices.numero_factura`, `fecha_emision`, `fecha_vencimiento` → nullable (Laravel 11
     `->change()` nativo en Postgres; NO quitar el unique de `numero_factura` — PG tolera muchos NULL).
2. `backend/database/migrations/2026_08_31_000001_add_dias_credito_to_clients_table.php`
   - `clients.dias_credito` INT NOT NULL DEFAULT 30.

### 2. Enum y modelo

3. `backend/app/Enums/InvoiceStatus.php`: + `case BORRADOR = 'BORRADOR';`
4. `backend/app/Models/Client.php`: `dias_credito` a fillable (+ cast integer). Revisar
   `StoreClientRequest` (o equivalente): validar `dias_credito` integer 0–365.

### 3. InvoiceService (`backend/app/Services/InvoiceService.php`)

5. Extraer helper privado `crearDetallesConProteccion(Invoice, array $details)`: el bloque actual de
   creación de detalles + re-chequeo de lecturas facturadas + captura de 23505 (líneas 50–89).
   Reutilizarlo en `create`, `createDraft` y `recalcular`.
6. `createDraft(array $data, User $creator): Invoice`
   - Requiere `cliente_id`, `periodo_inicio`, `periodo_fin` (los valida el FormRequest).
   - **Siempre** recalcula con `InvoiceCalculationService` (nunca confía montos, D1).
   - Si no hay contratos activos o `monto_total == 0` → `BusinessRuleException` sugiriendo captura directa.
   - Crea: `estado= BORRADOR`, `monto_total` calculado, `monto_pagado=0`, `saldo_pendiente=0`,
     `numero_factura/fecha_emision/fecha_vencimiento = null`, `fecha_creacion=now()`, socio/creado_por.
   - Transacción + detalles vía helper (reserva lecturas).
   - Devuelve `$invoice->fresh(['client','details'])` **+ advertencias del cálculo** (array en la
     respuesta del controller, ver tarea 10).
7. `emitir(Invoice $invoice, array $data): Invoice`
   - Guarda: `estado === BORRADOR` o `BusinessRuleException` (422).
   - Transacción: validar folio único (`numero_factura` exists + unique index como respaldo);
     `fecha_vencimiento = fecha_emision + cliente.dias_credito`; `estado=PENDIENTE`;
     `saldo_pendiente = monto_total`.
   - (Fase 1 añadirá aquí el re-chequeo de solapamiento; dejar comentario.)
8. `recalcular(Invoice $invoice): array{invoice, advertencias}`
   - Guarda BORRADOR. Transacción: borrar detalles, recalcular con cliente+periodo propios de la
     factura, recrear detalles (helper), actualizar `monto_total`.
9. `destroy(Invoice $invoice): void` — guarda BORRADOR (si no, `BusinessRuleException`); `$invoice->delete()`.
10. `create()` (captura directa, existe): **derivar** `fecha_vencimiento = fecha_emision + cliente.dias_credito`
    e ignorar cualquier `fecha_vencimiento` del payload.
11. Helper privado `derivarVencimiento(Client $cliente, $fechaEmision)`.

### 4. Advertencia de solapamiento (detector, no bloqueante)

12. `InvoiceCalculationService::calcularEstimacion`: agregar advertencia si existen facturas del
    cliente con `periodo_inicio <= periodo_fin_nuevo AND periodo_fin >= periodo_inicio_nuevo`
    (cualquier estado, con periodo no nulo): `"El periodo se solapa con la factura F-XXXXXX
    (2026-05-01 a 2026-05-31)…"`. Solo `advertencias[]`, sin alterar `monto_total`.

### 5. FormRequests, Controller y rutas

13. `StoreInvoiceRequest` (captura directa): quitar `fecha_vencimiento` de rules (queda derivado).
14. Nuevo `backend/app/Http/Requests/StoreInvoiceDraftRequest.php`:
    - `numero_factura`, `fecha_emision`, `fecha_vencimiento` → `prohibited`
    - `cliente_id` required exists; `periodo_inicio` required date; `periodo_fin` required
      `after_or_equal:periodo_inicio`; `notas` nullable.
15. Nuevo `backend/app/Http/Requests/EmitInvoiceRequest.php`:
    `numero_factura` required|string, `fecha_emision` required|date.
16. `InvoiceController`:
    - `storeDraft(StoreInvoiceDraftRequest)` → 201 + InvoiceResource (+ campo `advertencias` en la respuesta).
    - `emitir(EmitInvoiceRequest, Invoice)` / `recalcular(Invoice)` / `destroy(Invoice)`.
    - `index()`: **excluir BORRADOR por defecto**; permitir verlo solo con `?estado=BORRADOR`
      explícito (protege CxC `ReceivablesList` y dashboards sin tocarlos).
17. `backend/routes/api.php` (grupo `permission:finanzas.facturas`, líneas 149–153):
    ```php
    Route::post('invoices/draft', [InvoiceController::class, 'storeDraft']);
    Route::post('invoices/{invoice}/emitir', [InvoiceController::class, 'emitir']);
    Route::post('invoices/{invoice}/recalcular', [InvoiceController::class, 'recalcular']);
    ```
    (`destroy` ya queda registrado por el `apiResource` existente.)

### 6. Guardas laterales

18. `PaymentService::registerPayment`/`validateAmount` (`backend/app/Services/PaymentService.php`):
    rechazar pagos sobre facturas BORRADOR (`BusinessRuleException`).
19. `CfdiService` (~líneas 163–180, `Invoice::create` con `$fechaVencimiento`): revisar el origen del
    valor; cuando no venga del CFDI/overrides, derivarlo de `cliente.dias_credito` con el helper.

### 7. Scheduler de vencidos (deuda §10)

20. Nuevo `backend/app/Console/Commands/CheckOverdueInvoices.php` (signature `invoices:check-overdue`,
    patrón de `GenerateUpcomingVisits.php`): llama `InvoiceService::checkOverdue()`.
21. `backend/routes/console.php`: `Schedule::command('invoices:check-overdue')->dailyAt('02:30')
    ->timezone('America/Cancun')->withoutOverlapping();`

### 8. Seeder

22. `backend/database/seeders/InvoiceSeeder.php`: +2 facturas BORRADOR (folios/emisión/vencimiento
    NULL, saldo 0, periodo del mes en curso, notas "Borrador demo").

### 9. Tests backend — nuevo `backend/tests/Feature/InvoiceDraftTest.php`

Seguir convenciones de `InvoiceCalculationTest.php` (helpers createUser/createClient/createContract,
`RefreshDatabase`, `Tests\TestCase`). Casos:

1. `createDraft` → estado BORRADOR, sin folio, detalles creados, NO incluido en `getOutstandingBalance`.
2. `createDraft` con monto calculado 0 (sin contratos activos) → `BusinessRuleException`.
3. `emitir` sin folio → 422; con folio duplicado → 422.
4. `emitir` válido → PENDIENTE, `fecha_vencimiento == fecha_emision + dias_credito`,
   `saldo_pendiente == monto_total`.
5. Dos borradores no pueden reservar la misma lectura → `BusinessRuleException` (lectura ya facturada).
6. `recalcular` tras capturar una lectura nueva en el periodo → monto/detalles actualizados.
7. `destroy` en BORRADOR ok (detalles liberados: la lectura vuelve a ser facturable); en PENDIENTE → 422.
8. Pago sobre BORRADOR → 422.
9. Captura directa (`create`): `fecha_vencimiento` del payload ignorada, derivada del cliente.
10. `GET /invoices` sin filtro no devuelve BORRADOR; con `?estado=BORRADOR` sí.
11. `calcular` incluye advertencia cuando ya existe factura con periodo solapado.

### 10. Frontend

23. `frontend/src/types/invoice.ts`: `numero_factura`, `fecha_emision`, `fecha_vencimiento` → `string | null`.
24. `frontend/src/types/enums.ts`: `InvoiceStatus` + `BORRADOR: 'BORRADOR'`. Buscar dónde se mapean
    etiquetas/colores de estado de factura (selects hardcodeados en `InvoiceList.tsx:248–255` y
    `ReceivablesList.tsx:251–259`, badges en listas/detalle): añadir **"Borrador"** con badge gris
    (secondary) SOLO en el módulo Facturas; CxC no lo muestra (excluido por backend).
25. `frontend/src/hooks/useInvoices.ts`: + `useCreateInvoiceDraft` (POST `/invoices/draft`),
    `useEmitInvoice` (POST `/invoices/{id}/emitir`), `useRecalcInvoice` (POST `/invoices/{id}/recalcular`),
    `useDeleteInvoice` (DELETE `/invoices/{id}`). Invalidar `['invoices']` en onSuccess.
26. `frontend/src/pages/finance/invoices/RegisterInvoicePage.tsx`:
    - Paso 1: nuevo radio **"Destino del documento"**: (a) *Borrador (calculado, emitir después)* —
      recomendado — oculta folio/fecha_emision y fija método a lecturas; (b) *Factura ya emitida en
      PAC* — flujo actual con folio + fecha_emision + método lecturas/manual.
    - **Eliminar el input de `fecha_vencimiento`** (líneas 165–172) y su fila del resumen (línea 357)
      en ambos modos (el servidor lo deriva).
    - Botón final según destino: "Crear Borrador" / "Registrar Factura"; payload draft =
      `{cliente_id, periodo_inicio, periodo_fin, notas}`.
    - Éxito draft → navegar al detalle de la factura creada.
27. `frontend/src/pages/finance/invoices/InvoiceDetail.tsx`: si `estado === 'BORRADOR'`:
    - Acciones header: **Emitir** (modal: folio + fecha_emision, copy con consecuencias: "pasará a
      cuenta por cobrar…"), **Recalcular** (confirmación), **Eliminar** (danger modal con checkbox,
      patrón §9.4).
    - Ocultar sección pagos; mostrar aviso "Borrador: aún no es cuenta por cobrar".
28. `ReceivablesList.tsx`: sin cambios funcionales (la exclusión es backend).

---

## Verificación

```bash
docker compose exec app php artisan migrate          # o reiniciar app (entrypoint migra)
docker compose exec app php artisan test             # suite completa + InvoiceDraftTest
docker compose run --rm --no-deps frontend sh -c "npm run build"   # recompilar dist
# Recargar http://localhost:8080 con Ctrl+F5
```

Smoke manual (8080): (1) wizard modo Borrador sin folio → aparece en Facturas con filtro Borrador;
(2) Emitir con folio → PENDIENTE, vencimiento = emisión + 30; (3) CxC no lista borradores;
(4) pago a borrador rechazado; (5) `/invoices/calcular` con periodo ya facturado muestra advertencia.

## Riesgos y notas

- `->change()` de nullability en Postgres: soportado nativamente en Laravel 11; probar la migración
  con datos sembrados existentes (las 20 facturas del seeder siguen siendo emitidas, cumplen NOT NULL).
- Supuestos de `numero_factura` no nulo: `search()` por columna funciona con NULL; el auto-link CFDI
  compara por valor (NULL nunca matchea) — sin cambio.
- Las 2 facturas duplicadas creadas en pruebas por el usuario son **limpieza manual de datos**
  (borrar la que no se conserve, si no tiene pagos), fuera del alcance del código.

## Fuera de alcance (Fase 1 posterior / futuro)

- Bloqueos duros de solapamiento en `createDraft`/`recalcular`/`emitir` (detector ya queda en cálculo).
- Notas de crédito, prorrateos, edición de monto en borrador, override de `dias_credito` por contrato.
