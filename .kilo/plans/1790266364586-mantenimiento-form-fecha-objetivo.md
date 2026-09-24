# Plan: UX de órdenes de mantenimiento — formulario de alta, "fecha objetivo" y ubicación taller/piso

## Contexto

El formulario de alta de órdenes (`CreateMaintenanceOrder.tsx`) mezcla datos de *levantamiento* (solicitud) con datos de *ejecución* (programación, costos). El modelo acordado con el usuario:

- **Levantar una orden = solicitud.** El operador/admin reporta; no dispone del tiempo del técnico.
- **Programar = decisión del área técnica.** El técnico atiende según la cola del Taller (severidad + antigüedad) y define la fecha objetivo editando la orden PROGRAMADA.
- **No** se crean visitas automáticas desde órdenes (semántica del scheduler D2/D8 intacta).
- **No** se agrega estado `PENDIENTE` (fuera de alcance; la fecha==reporte equivale a "sin programar").
- La ubicación física (taller vs piso) se **deriva** de la impresora: `cliente` vía `currentAssignment` → piso; `warehouse` → taller. Ya expuesta por `PrinterResource` cuando las relaciones están cargadas.

Cambios aprobados: (1) ocultar tipo de problema en preventivo, (2) label dinámico de descripción, (3) quitar costo de mano de obra del alta (dejarlo solo al completar), (4) prefill de descripción en preventivo, (6) quitar fecha del alta + semántica "Fecha objetivo" + próxima visita como contexto calculado + chip de objetivo vencido, (7) chip En taller / En piso en detalle y cola del Taller.

**Sin migraciones. Sin cambios de rutas/config. Móvil sin cambios** (`ReportFailurePage.tsx:141` envía `fecha` explícita; compatible con validación relajada).

---

## Tareas

### Backend

**T1. `backend/app/Http/Requests/StoreMaintenanceOrderRequest.php`**
- Añadir `prepareForValidation()`: si no viene `fecha`, mergear `fecha => today()->toDateString()`. Mantener la regla `'fecha' => 'required|date'` (queda satisfecha por el default).
- No tocar el resto de reglas (`desc_problema` sigue nullable — ver "Fuera de alcance").

**T2. `backend/app/Services/MaintenanceService.php` — `update()`**
- Añadir `Cache::forget('taller.dashboard')` al final de `update()` (create/complete/cancel/delete ya lo hacen). La cola del Taller ahora muestra `fecha`/ubicación; editar la fecha debe invalidar la cache.

**T3. `backend/app/Http/Controllers/MaintenanceOrderController.php` — `show()`**
- Cargar: `printer.currentAssignment.contract.client` y `printer.warehouse` (además de las ya cargadas: printer, socio, visit, articlesUsed.article, expenses).
- Calcular `proxima_visita` si hay contrato activo: primera `Visit` del contrato con `estado` in [PENDIENTE, REPROGRAMADA] y `fecha_programada >= today()`, `orderBy('fecha_programada')`, `first()`. Shape: `['id' => ..., 'fecha_programada' => ...->toDateString(), 'tipo_visita' => ...?->value]` o `null`.
- Devolver con `(new MaintenanceOrderResource($order->load(...)))->additional(['proxima_visita' => $proximaVisita])`. Importar `App\Models\Visit`.

**T4. `backend/app/Http/Controllers/TallerController.php` — cola**
- Select: añadir `'fecha'`.
- Eager loads (reemplazar el `with('printer:id,...')` actual):
  ```php
  ->with([
      'printer:id,marca,modelo,codigo_negocio,almacen_id',
      'printer.warehouse:id,nombre',
      'printer.currentAssignment.contract:id,client_id,codigo_negocio',
      'printer.currentAssignment.contract.client:id,razon_social',
  ])
  ```
  (`currentAssignment` ya filtra `activa = true` en el modelo, Printer.php:136.)
- En el `map` de cada item añadir:
  - `'fecha' => $order->fecha?->toDateString()`
  - `'ubicacion'`: si `$order->printer?->currentAssignment?->contract` existe → `['lugar' => 'PISO', 'cliente' => contract->client?->razon_social, 'contrato' => contract->codigo_negocio]`; si no → `['lugar' => 'TALLER', 'almacen' => $order->printer?->warehouse?->nombre]` (almacen puede ser null).

### Frontend (web)

**T5. `frontend/src/pages/inventory/maintenance/CreateMaintenanceOrder.tsx`**
- Eliminar estado `fecha` y su campo "Fecha Programada"; **no enviar** `fecha` en el payload (lo estampa el backend, T1).
- Eliminar estado `costoManoObra` y su campo; **no enviar** `costo_mano_obra` (default 0; se captura al completar).
- `canSubmit = printerId != null && !!descripcion`.
- Tipo de problema: renderizar el select solo cuando `tipo === 'correctivo'`, junto a severidad dentro del mismo grid condicional (envolver el `<div className="grid grid-cols-2...">` completo en `{tipo === 'correctivo' && (...)}` para no dejar un grid vacío en preventivo). En el `onChange` de tipo, resetear `tipoProblema` además de `severidad` cuando v !== 'correctivo'.
- Label dinámico de descripción: correctivo → `Descripción del problema *` con placeholder "Describe la falla reportada..."; preventivo → `Motivo del servicio *` con placeholder "Describe el motivo y alcance del servicio...".
- Prefill preventivo: constante `const DESC_PREVENTIVO_DEFAULT = 'Servicio preventivo programado — limpieza y revisión general'`. Inicializar `descripcion` con el default cuando el tipo inicial sea preventivo; al cambiar tipo a preventivo, setear el default si `descripcion` está vacía o era exactamente el default.
- Modal de confirmación: añadir bullet "• La fecha objetivo inicia como la fecha de reporte (hoy)".

**T6. `frontend/src/types/maintenance-order.ts`**
- En `MaintenanceOrder.printer` añadir opcionales: `cliente?: { id: number; nombre: string; contrato_id?: number; contrato_codigo?: string } | null` y `warehouse?: { id: number; nombre: string } | null` (mismo shape que `types/printer.ts:21-22`; `PrinterResource` ya los expone whenLoaded).
- Añadir `proxima_visita?: { id: number; fecha_programada: string; tipo_visita?: string | null } | null`.

**T7. `frontend/src/pages/inventory/maintenance/MaintenanceDetail.tsx`**
- Chip de ubicación junto al título (marca/modelo, línea ~286):
  - Si `order.printer?.cliente` → Badge/etiqueta `En piso — {cliente.nombre} ({cliente.contrato_codigo})`. Si además `order.printer?.estado === 'EN_MANTENIMIENTO'`, subtexto: "Equipo aún en piso del cliente (pendiente de recolectar)". (Matiz D23: EN_MANTENIMIENTO sigue asignada y facturando.)
  - Si no → `En taller — {order.printer?.warehouse?.nombre ?? 'almacén no asignado'}`.
- Relabels: "Fecha" (línea ~325) → "Fecha objetivo"; "fecha programada" (línea ~574) → "fecha objetivo"; en el modal de edición "Fecha Programada" (línea ~616) → "Fecha objetivo" con helper: "La orden nace con la fecha de reporte; el área técnica define la fecha objetivo al programar el servicio."
- Chip de objetivo vencido: si `estado === 'PROGRAMADA'` y `fecha < hoy` (comparar `YYYY-MM-DD`), mostrar Badge warning "Objetivo vencido" junto a la fecha objetivo.
- Contexto de próxima visita: si `proxima_visita` presente, línea informativa "Próxima visita programada del contrato: {formatDate(fecha_programada)}" cerca de la fecha objetivo.
- Modal de edición: eliminar el campo "Costo de Mano de Obra" (estado `editCosto`, su inicialización en `openEditModal` y su entrada en el payload de `updateMutation`). Queda solo al completar (modal de completar ya lo pide).

**T8. `frontend/src/pages/inventory/maintenance/MaintenanceList.tsx`**
- Columna `fecha`: label "Fecha" → "Fecha objetivo" (línea ~90). Sin chip aquí (los chips viven en detalle y Taller).

**T9. `frontend/src/hooks/useTaller.ts`**
- `TallerColaItem`: añadir `fecha?: string | null` y `ubicacion?: { lugar: 'PISO' | 'TALLER'; cliente?: string | null; contrato?: string | null; almacen?: string | null } | null`.

**T10. `frontend/src/pages/inventory/taller/TallerDashboard.tsx` — cola**
- Nueva columna "Ubicación" (entre Impresora y Tipo): PISO → Badge warning `En piso · {ubicacion.cliente}` (truncado); TALLER → Badge secondary `En taller · {ubicacion.almacen ?? 's/almacén'}`; null → "-".
- Indicador de vencido: en la celda Orden (o Antigüedad), texto `text-destructive text-xs` "objetivo vencido" cuando `item.fecha && item.fecha < hoy` (`new Date().toISOString().split('T')[0]`).

### Documentación

**T11. `PROJECT.md`**
- Añadir fila D25 en la tabla §8: *"La orden nace con `fecha` = reporte (auto-estampada); 'programar' = el área técnica edita la Fecha objetivo de la orden PROGRAMADA; sin estado PENDIENTE ni visitas automáticas desde órdenes (el scheduler D2/D8 queda intacto). Ubicación taller/piso derivada de cliente/warehouse, mostrada en detalle y cola."* Racional corto: levantar ≠ disponer del tiempo del técnico.
- No tocar "Última revisión" ni §10.

### Pruebas

**T12. `backend/tests/Feature/MaintenanceOrderDefaultsTest.php` (nuevo, estilo `MaintenanceProblemFieldsTest`)**
- `test_store_sin_fecha_la_estampa_con_hoy`: POST sin `fecha` → 201, `fecha === today()->toDateString()` en BD/respuesta.
- `test_show_expone_ubicacion_y_proxima_visita`: impresora RENTADA con contrato activo (`ContractPrinter` activa + contrato + cliente) y visita PENDIENTE futura → `printer.cliente.nombre` presente y `proxima_visita.fecha_programada` correcta; impresora EN_ALMACEN con almacén → `printer.warehouse.nombre` presente y `proxima_visita` null.
- Verificar que la suite existente no rompe (los tests actuales siempre envían `fecha` explícita — compatible).

---

## Edge cases / invariantes

- Llamadas internas que bypass el FormRequest (`MaintenancePlanService` pasa fecha calculada; `ContractService` retiro con orden D24) — intactas.
- `MaintenanceService::update()` recalcula `costo_total` con `calculateTotalCost()` — quitar el input del modal de edición no afecta (deja de enviarse, es nullable).
- Móvil: `CompleteMaintenancePage` y `ReportFailurePage` no cambian; el reporte de falla sigue enviando `fecha: todayISO()`.
- `warehouse` puede ser null (impresora EN_MANTENIMIENTO sin almacén) → fallback de texto.
- Zona horaria: `today()` usa la timezone de la app (misma que el scheduler).

## Fuera de alcance (explícito)

- Estado `PENDIENTE` previo a PROGRAMADA / SLA de atención.
- Asignación de técnico (`completado_por` / `tecnico_asignado_id`).
- Hacer `desc_problema` required en backend (la UI ya lo exige; el móvil podría enviarlo vacío — no arriesgar).
- Reordenar la cola por fecha objetivo (severidad + antigüedad sigue mandando).

## Validación

```bash
docker compose exec app php artisan test
docker compose run --rm --no-deps frontend sh -c "npm run lint"
docker compose run --rm --no-deps frontend sh -c "npm run build"   # rebuild del dist (puerto 8080, Ctrl+F5)
```

Smoke manual en `http://localhost:8080`:
1. Alta preventivo: sin campos fecha/costo, tipo de problema oculto, descripción prellenada editable.
2. Alta correctivo: tipo de problema + severidad visibles, label "Descripción del problema".
3. Detalle: chip En piso/En taller, "Fecha objetivo", chip vencido (probar editando fecha a pasado), próxima visita para rentada.
4. Cola del Taller: columna Ubicación + "objetivo vencido" (nota: la cola usa cache — invalidada por T2).
5. Móvil `/m/`: reportar falla sigue creando orden correctiva sin cambios.
