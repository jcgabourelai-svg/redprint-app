# Plan: Retiro con orden de servicio (preventivo/correctivo) + visibilidad y bloqueo por órdenes abiertas

## Objetivo

1. Al retirar una impresora de un contrato por **cualquier motivo** (no solo falla), permitir **crear una orden de servicio PREVENTIVA** en la misma transacción (checkbox explícito).
2. Unificar la web con la móvil: el retiro web por `SUSTITUCION_FALLA` también podrá crear la orden **CORRECTIVA** (hoy solo la móvil lo hace — hueco detectado).
3. El catálogo de impresoras (web y móvil) debe **mostrar en badge/chip** cuando un equipo tiene una orden `PROGRAMADA` abierta (preventiva o correctiva).
4. **Bloqueo duro**: `assignPrinter` rechaza con 422 si la impresora tiene una orden `PROGRAMADA` abierta (decisión del usuario: bloqueo duro, sin override).

## Decisiones de diseño (cerradas)

| # | Decisión | Justificación |
|---|---|---|
| D1 | **NO se agrega estado `EN_REVISION`**. Las órdenes creadas al retirar (preventiva o correctiva) dejan la impresora en `EN_MANTENIMIENTO` | El guard existente `estado !== EN_ALMACEN` en `assignPrinter` (ContractService.php:223) bloquea gratis; la maquinaria de restauración (`estado_anterior_impresora`) ya existe; la distinción revisión/reparación vive en el **tipo de orden**, visible vía badge |
| D2 | `MaintenanceService::create` gana flag **explícito** `sacarDeCirculacion` (default `false`) | Filosofía D23 de PROJECT.md: flags explícitos. Las órdenes PREVENTIVAS creadas desde la web (equipo rentado, servicio en visita) **NO cambian de estado** — comportamiento actual intacto |
| D3 | `restorePrinterState` pasa a ejecutarse cuando `estado_anterior_impresora !== null` (hoy: solo `tipo === CORRECTIVO`) | La restauración se keyed por "¿desplazamos la impresora?", no por tipo. Correctivos actuales ya guardan estado_anterior; preventivos web tienen null → sin restauración (sin cambio) |
| D4 | **Cero migraciones**: se reutiliza la columna `maintenance_orders.estado_anterior_impresora` | Ya existe y es nullable |
| D5 | Permiso backend: si `crear_orden_mantenimiento` viene true, exigir además `inventario.mantenimiento` (403) | La ruta `release-printer` solo exige `permission:contratos` (routes/api.php:116). La móvil ya se auto-limita con `canMaintain`; el backend queda consistente |
| D6 | Orden preventiva: `desc_problema` **opcional**; si viene vacía se autocompleta `"Servicio preventivo al retirar del contrato {codigo_negocio}"` | `StoreMaintenanceOrderRequest` ya la declara nullable; un retiro preventivo no describe una "falla" |
| D7 | Guard anti-duplicado: si la impresora ya tiene orden `PROGRAMADA`, el retiro con orden → 422 | Cierra hueco preexistente: reporte de falla en móvil (crea correctiva) + retiro con orden = dos órdenes abiertas |
| D8 | `finish()`/`cancel()` de contrato **siguen sin crear órdenes** (defaults false, igual que hoy) | ContractService.php:128 y :152 llaman posicionalmente con 8 args; agregar params al final no los toca |

## Cambios backend (Laravel)

### B1. `backend/app/Services/MaintenanceService.php`

- `create(array $data, User $creator, bool $sacarDeCirculacion = false)`:
  - Cambiar el `if ($order->tipo_mantto === CORRECTIVO)` (línea 35) por `if ($order->tipo_mantto === CORRECTIVO || $sacarDeCirculacion)`:
    - Guardar `estado_anterior_impresora` y pasar impresora a `EN_MANTENIMIENTO` (igual que hoy para correctivo).
    - Evento `MANTENIMIENTO_INICIO` con descripción que mencione el tipo: `"Inicio mantenimiento {preventivo|correctivo} - Orden #N"`.
- `complete()` (líneas 143-163): reestructurar:
  - Si `estado_anterior_impresora !== null` → `restorePrinterState(...)` (evento `MANTENIMIENTO_FIN` o `MANTENIMIENTO_PREVENTIVO_FIN` según tipo).
  - Si `tipo === PREVENTIVO` → mantener SIEMPRE el evento `MANTENIMIENTO_PREVENTIVO` (también para el caso con restauración).
- `cancel()` (línea 180) y `delete()` (línea 201): ya llaman a `restorePrinterState` incondicionalmente; funciona con D3 sin cambios adicionales.
- `restorePrinterState()` (línea 272): cambiar guard de entrada de `tipo !== CORRECTIVO → return` a `estado_anterior_impresora === null → return`.

### B2. `backend/app/Services/ContractService.php` — `releasePrinter`

- Firma append-only (línea 333): agregar al final `?MaintenanceType $tipoOrden = null`.
- Antes de crear la orden (línea 416), guard anti-duplicado (D7):
  ```php
  if ($crearOrdenMantenimiento && MaintenanceOrder::where('impresora_id', $printer->id)
      ->where('estado', MaintenanceStatus::PROGRAMADA)->exists()) {
      throw new BusinessRuleException('La impresora ya tiene una orden de mantenimiento abierta');
  }
  ```
- Llamada a `maintenanceService->create(...)` (línea 417): pasar `'tipo_mantto' => $tipoOrden ?? MaintenanceType::CORRECTIVO` y `sacarDeCirculacion: true` (para correctivo es idempotente con el comportamiento actual).
- `desc_problema` default (D6) cuando `$descProblema === null` y la orden es PREVENTIVA.

### B3. `backend/app/Http/Controllers/ContractController.php` — `releasePrinter` (línea 165)

- Validación: `desc_problema` pasa a `required_with:crear_orden_mantenimiento` **solo cuando** motivo = `SUSTITUCION_FALLA`; en otros motivos nullable (notas opcionales). Implementar con validación condicional post-`validate()` (lanzando `ValidationException::withMessages`) o reglas closures.
- Guards:
  - `$tipoOrden = $data['motivo_liberacion'] === 'SUSTITUCION_FALLA' ? CORRECTIVO : PREVENTIVO` (el tipo se deriva del motivo; un retiro por falla con orden siempre es correctivo, los demás preventivo).
  - Permiso (D5): si `crear_orden_mantenimiento` → `$request->user()->can('inventario.mantenimiento')` o 403 con mensaje claro.
- Pasar `$tipoOrden` a `releasePrinter`.
- `assignPrinter` ya no requiere cambios de validación aquí (el guard vive en el service).

### B4. `backend/app/Services/ContractService.php` — `assignPrinter` (línea 223)

- Nuevo guard inmediatamente después del check de estado:
  ```php
  $ordenAbierta = MaintenanceOrder::where('impresora_id', $printerId)
      ->where('estado', MaintenanceStatus::PROGRAMADA)->first();
  if ($ordenAbierta !== null) {
      throw new BusinessRuleException(
          "La impresora tiene una orden de mantenimiento abierta (#{$ordenAbierta->id}). Complétala o cancélala antes de asignarla."
      );
  }
  ```

### B5. `backend/app/Models/Printer.php`

- Relación: `openMaintenanceOrder()` — `hasOne(MaintenanceOrder)->where('estado', PROGRAMADA)->orderByDesc('id')`.

### B6. `backend/app/Http/Controllers/PrinterController.php` — `index`

- Añadir al query: `->withCount(['maintenanceOrders as ordenes_abiertas_count' => fn ($q) => $q->where('estado', PROGRAMADA)])` y `->with('openMaintenanceOrder:id,impresora_id,tipo_mantto,estado,fecha')`.

### B7. `backend/app/Http/Resources/PrinterResource.php`

- `'ordenes_abiertas_count' => $this->whenNotNull($this->ordenes_abiertas_count)`
- `'open_maintenance_order' => $this->whenLoaded('openMaintenanceOrder', fn () => $this->openMaintenanceOrder ? ['id', 'tipo_mantto', 'fecha'] : null)`
- Incluir lo mismo en `PrinterDetailResource` (la ficha muestra las órdenes; el header puede usar el chip).

## Cambios frontend web

### F1. `frontend/src/types/printer.ts`

- `Printer` += `ordenes_abiertas_count?: number`, `open_maintenance_order?: { id: number; tipo_mantto: 'PREVENTIVO' | 'CORRECTIVO'; fecha: string } | null`.

### F2. `frontend/src/pages/inventory/printers/PrinterList.tsx`

- Columna Estado (línea 91): junto al badge existente, si `row.open_maintenance_order` → chip ámbar `🔧 Orden {tipo label} #{id}` (usar `Badge` existente o estilos inline como el callout de rentada). Tooltip/cell informativo, no bloquea nada aquí.

### F3. `frontend/src/pages/contracts/ContractDetail.tsx`

- **Modal "Liberar impresora"** (línea 1281):
  - Estado nuevo: `releaseCrearOrden` (bool), `releaseDescOrden` (string).
  - Gate: `const canMaintain = useTienePermiso('inventario.mantenimiento')` (existe en `contexts/AuthContext.tsx:91`).
  - Si `canMaintain`:
    - motivo `SUSTITUCION_FALLA` → checkbox "Crear orden de mantenimiento correctiva" + textarea `desc_problema` (obligatoria si marcado, mín. 5 — paridad con móvil).
    - otros motivos → checkbox "Enviar a servicio preventivo (crear orden)" + textarea de notas **opcional**.
    - sin permiso → texto informativo "No tienes permiso de mantenimiento: la impresora se retirará sin orden" (paridad con `RemovalPage.tsx:355`).
  - `handleRelease` (línea 300): enviar `crear_orden_mantenimiento: releaseCrearOrden || undefined` y `desc_problema` (trim o undefined). Toast de éxito diferenciado ("...y orden de mantenimiento creada").
- **Modal asignar impresora** (usa `usePrinters({ estado: EN_ALMACEN })`, línea 122):
  - Las opciones de impresoras con `open_maintenance_order` quedan **disabled** con sufijo `(orden #N abierta)`; no ocultar (transparencia del porqué no está disponible).
  - El backend también responde 422 → `parseApiError` lo muestra (red de seguridad).

### F4. `frontend/src/types/contract.ts`

- Sin cambios de tipos de dominio (`MotivoLiberacion` intacto); el payload del release solo agrega campos opcionales ya tipados en el hook `useReleasePrinter` (verificar su tipo de payload en `frontend/src/hooks/useContracts*`).

## Cambios mobile

### M1. `mobile/src/types/api.ts`

- `Printer` += `open_maintenance_order?: { id: number; tipo_mantto: string; fecha: string } | null`.

### M2. `mobile/src/pages/RemovalPage.tsx`

- Generalizar (líneas 49-60, 130-135, 355+):
  - `enviarCrearOrden = crearOrden && canMaintain` (ya no condicionado al motivo).
  - El **tipo** lo decide el backend a partir del motivo (correctivo si falla, preventivo en el resto) — el móvil no envía tipo.
  - UI: con `SUSTITUCION_FALLA` mantener bloque actual (checkbox default **on**, desc obligatoria ≥5); con otros motivos mostrar checkbox "Enviar a servicio preventivo" default **off** + notas opcionales.
  - `desc_problema`: enviar `undefined` si preventivo y notas vacías (backend autocompleta, D6).
  - Toast de éxito diferenciado por tipo resultante.
  - Banner sin-permiso generalizado a cualquier motivo con checkbox visible.

### M3. `mobile/src/pages/InstallationPage.tsx`

- Cards de impresoras (línea 461): si `p.open_maintenance_order` → card **disabled** (sin onClick) + chip `🔧 Orden #{id} abierta`. Defensivo: hoy el filtro `estado=EN_ALMACEN` ya excluye `EN_MANTENIMIENTO`; esto cubre el caso orden-web-preventiva sobre equipo en almacén.

### M4. `mobile/src/pages/PrinterDetailPage.tsx`

- Si el detalle muestra estado: chip informativo de orden abierta (mismo criterio), solo lectura.

## Documentación

- `PROJECT.md`: nueva fila **D24** en la tabla de decisiones (retiro con orden preventiva/correctiva unificada, bloqueo duro por orden abierta, reuso de `EN_MANTENIMIENTO` + `estado_anterior_impresora`, sin migraciones). Actualizar la fila D23 si menciona "solo correctivo".
- `docs/manual-usuario/02-administrador.md` (~línea 150, "Liberar impresora"): describir ambas casillas y el requisito de permiso.
- `docs/manual-usuario/03-operador-campo.md` (~líneas 162-173, flujo de retiro): paso del checkbox preventivo y del bloqueo en instalación.
- `docs/manual-usuario/05-almacenista.md` (~línea 106): nota de que un equipo retirado con orden queda "en taller" (no re-entregable hasta cerrar la orden).
- `mobile/README.md`: alcance del retiro con orden preventiva.

## Tests (backend)

Ejecutar con `docker compose exec app php artisan test`. Extender `backend/tests/Feature/ReleaseCreatesMaintenanceTest.php` y crear lo que falte:

1. Retiro motivo `ROTACION` + `crear_orden_mantenimiento` → orden **PREVENTIVA** creada, impresora `EN_MANTENIMIENTO` con `estado_anterior=EN_ALMACEN`, `LIBERACION_CONTRATO.datos_adicionales.orden_mantto_id` presente, `MANTENIMIENTO_INICIO` con tipo preventivo.
2. `complete()` de esa orden → impresora vuelve a `EN_ALMACEN` + evento fin; `cancel()` y `delete()` → ídem (restauración).
3. Retiro por falla con flag (web unificado) → orden CORRECTIVA (regresión del flujo actual, móvil).
4. **Duplicado**: impresora con orden PROGRAMADA previa + retiro con orden → 422 (D7).
5. **Bloqueo**: `assignPrinter` sobre impresora `EN_ALMACEN` con orden PROGRAMADA → 422; tras `cancel()` de la orden → asignación exitosa.
6. **Sin regresión preventivo web**: `maintenanceService->create` PREVENTIVO sin flag → estado de impresora intacto; `complete()` no restaura (estado_anterior null) y sí escribe `MANTENIMIENTO_PREVENTIVO`.
7. Permiso: usuario con `contratos` pero sin `inventario.mantenimiento` + flag → 403.
8. Validación: falla + flag sin `desc_problema` → 422; motivo ≠ falla + flag sin notas → 201 (desc autocompletada).
9. Resource: `GET /printers` incluye `ordenes_abiertas_count` y `open_maintenance_order`.

## Validación manual (Docker, puerto 8080)

```powershell
docker compose exec app php artisan test
docker compose run --rm --no-deps frontend sh -c "npm run build"
docker compose run --rm --no-deps mobile sh -c "npm run build"
# recargar http://localhost:8080 y /m/ con Ctrl+F5
```

Escenario: contrato con impresora → retiro por "Rotación de flota" con checkbox preventivo (móvil y web) → catálogo muestra `EN_MANTENIMIENTO` + chip de orden; intentar instalarla en otro contrato → equipo no listado (o bloqueado con 422 visible en web); completar la orden en Inventario › Mantenimiento → impresora `EN_ALMACEN` y asignable de nuevo.

## Fuera de alcance

- Estado nuevo `EN_REVISION` (descartado por D1).
- Órdenes automáticas al `finish()`/`cancel()` de contrato (D8).
- Filtros por "tiene orden abierta" en el listado de impresoras (solo chip informativo).
- Retiro de impresoras `EN_MANTENIMIENTO` aún asignadas (flujo D23 de falla reportada en sitio): el guard D7 es lo único que cambia ahí.

## Riesgos y notas

- **Cambio de comportamiento visible**: retiro web por falla ahora puede crear orden correctiva (nuevo checkbox) — paridad con móvil, deseado.
- **Cambio de permiso**: crear orden al retirar exigirá `inventario.mantenimiento` en backend; hoy la ruta solo pedía `contratos`. Roles operador de campo ya tienen ambos permisos (manual 03).
- `releasePrinter` tiene 5 call sites conocidos (controller, finish, cancel, tests): firma append-only los preserva; correr suite completa.
