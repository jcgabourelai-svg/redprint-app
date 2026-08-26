# Plan: Visitas con motivo principal + actividades múltiples

## Problema

El módulo de visitas trata `tipo_visita` como restricción exclusiva en vez de motivo:
- Entrega de tóner solo posible si `tipo_visita === ENTREGA_INSUMOS` (bloqueado en backend por `DeliveryService`).
- No existe flujo para reportar fallas desde la móvil.
- Instalación/retiro no quedan vinculados a la visita ni la auto-completan.
- `POST /visits/{id}/complete` no valida nada (cierre vacío).
- El seeder nunca crea visitas `ENTREGA_INSUMOS`/`RETIRO`, así que esos flujos son indescubribles.

## Decisiones (acordadas con el usuario)

1. **Cierre de visita**: el backend exige al menos una actividad registrada (lectura, entrega, orden de mantto, instalación/retiro vinculado) **O** un `motivo_cierre` obligatorio. Nueva columna `visits.motivo_cierre`.
2. **Mantenimiento en móvil**: solo "Reportar falla" (crear orden `CORRECTIVO` con `visita_id` usando el endpoint existente). Completar órdenes queda en el panel web.
3. **Instalación/retiro**: parámetro opcional `visita_id` en los endpoints existentes `assign-printer`/`release-printer`; se estampa en `printer_histories.datos_adicionales`, auto-completa la visita `INSTALACION`/`RETIRO` y aparece en su detalle.
4. **Offline**: las nuevas acciones quedan online-only (cola offline sigue solo para lecturas).
5. **Alcance**: backend + app móvil + panel web admin.

Verificado en esquema: `article_deliveries.contrato_id` nullable, `maintenance_orders.visita_id` existe, `printer_histories.datos_adicionales` json, `BusinessRuleException` → 422.

---

## Fase 1 — Backend

### 1.1 Migración
Nueva migración `add_motivo_cierre_to_visits_table`: `$table->text('motivo_cierre')->nullable()->after('notas')`.
Agregar `motivo_cierre` a `Visit::$fillable`.

### 1.2 Entregas en cualquier visita
`backend/app/Services/DeliveryService.php`: eliminar el bloque `if ($visit->tipo_visita !== VisitType::ENTREGA_INSUMOS)` (mantener el guard de estado PENDIENTE/REPROGRAMADA y los demás).

### 1.3 Nuevo `App\Services\VisitService`
- `hasRegisteredActivity(Visit $visit): bool` — true si hay lecturas (`readings`), entregas (`deliveries`), órdenes de mantenimiento (`maintenanceOrders`) con `visita_id`, o eventos en `printer_histories` con `datos_adicionales->visita_id = visit->id` y `tipo_evento` en `[ASIGNACION_CONTRATO, LIBERACION_CONTRATO]`.
- `complete(Visit $visit, ?string $motivoCierre): Visit` — lanza `BusinessRuleException` (422) si `!hasRegisteredActivity && empty($motivoCierre)`; rechaza si la visita ya está COMPLETADA; setea estado, `fecha_realizada` y `motivo_cierre`.
- Refactor menor: `ReadingService::checkVisitCompletion` delega el update final en `VisitService::complete` (evita duplicar lógica; la actividad ya existe así que nunca exige motivo).

### 1.4 `VisitController@complete`
Validar `'motivo_cierre' => 'nullable|string|max:1000'` y delegar en `VisitService::complete`.

### 1.5 Instalación/retiro vinculados a visita
`backend/app/Http/Controllers/ContractController.php` (`assignPrinter`, `releasePrinter`):
- Aceptar `visita_id` opcional (`exists:visits,id`).
- Validar que la visita pertenezca al mismo contrato (`contrato_id === contract->id`) y esté PENDIENTE/REPROGRAMADA; si no, 422.
- Pasar `?int $visitaId` a `ContractService::assignPrinter`/`releasePrinter`: incluir `'visita_id' => $visitaId` en `datos_adicionales` del `PrinterHistory` creado.
- Tras la operación, si `visita->tipo_visita` coincide (`INSTALACION` para assign, `RETIRO` para release) y sigue PENDIENTE/REPROGRAMADA, auto-completar vía `VisitService::complete` (sin motivo; la actividad existe). Una segunda instalación sobre visita ya completada no debe fallar (el guard de auto-completar es silencioso).

### 1.6 `VisitResource` + `VisitController@show`
- Agregar `motivo_cierre` al recurso.
- Cargar `maintenanceOrders.printer` en `show()` y exponer `mantenimientos` (reusar `MaintenanceOrderResource`).
- En `show()`, setear relación manual `$visit->setRelation('printer_changes', PrinterHistory::where('datos_adicionales->visita_id', $visit->id)->whereIn('tipo_evento', ['ASIGNACION_CONTRATO','LIBERACION_CONTRATO'])->with('printer:id,marca,modelo,num_serie')->get())` y exponer en el recurso como `cambios_impresoras` (evento, fecha, impresora). Solo en detalle, no en `index()`.

### 1.7 Seeder
`backend/database/seeders/VisitSeeder.php`: agregar `ENTREGA_INSUMOS` y `RETIRO` a `$types`; garantizar al menos 1 visita `ENTREGA_INSUMOS` PENDIENTE en los próximos 7 días (para demo del flujo).

### 1.8 Tests backend
- `ArticleDeliveryTest`: reemplazar `test_rechaza_visita_de_otro_tipo` por `test_permite_entrega_en_visita_de_cualquier_tipo` (visita LECTURA → entrega 201, stock decrementa).
- Nuevo `VisitCompletionTest`:
  - complete sin actividades y sin motivo → 422; con motivo → 200 y `motivo_cierre` persistido.
  - complete con entrega registrada (sin motivo) → 200.
  - complete sobre visita COMPLETADA → 422.
  - `assign-printer` con `visita_id`: history con `datos_adicionales->visita_id`, visita INSTALACION auto-completada; `visita_id` de otro contrato → 422.
  - `release-printer` con `visita_id`: visita RETIRO auto-completada.
  - `POST /maintenance-orders` con `visita_id` → visible en `GET /visits/{id}` (`mantenimientos`).
- Correr los existentes afectados: `VisitSchedulingTest`, `SpontaneousVisitTest`.

## Fase 2 — App móvil (`mobile/src/`)

### 2.1 Tipos (`types/api.ts`)
`Visit` += `motivo_cierre: string | null`, `mantenimientos?: MaintenanceOrder[]`, `cambios_impresoras?: PrinterChange[]`. Nuevo tipo `MaintenanceOrder` (id, impresora_id, tipo_mantto, estado, desc_problema, fecha, impresora?: {marca, modelo}).

### 2.2 `VisitDetailPage.tsx` (rework central)
- Cabecera: badge "Motivo: {tipo_visita}" (deja de ser un switch).
- Sección **"Actividades"** (visible si estado editable), botones según permisos, con el del motivo resaltado:
  - 📊 Tomar lectura → `/visita/{id}/captura/{impresora}` (si hay impresoras activas; la lista de impresoras con progreso se mantiene como hoy para el motivo LECTURA).
  - 📦 Entregar insumos → `/visita/{id}/entrega` (permiso `inventario.articulos`).
  - 🔧 Reportar falla → `/visita/{id}/falla` (permiso `inventario.mantenimiento`, requiere impresoras).
  - 📥 Instalar impresora → `/visita/{id}/instalacion` (permisos `contratos`+`inventario.impresoras`).
  - 📤 Retirar impresora → `/visita/{id}/retiro` (ídem).
- Secciones de **registrado** (independientes del tipo): lecturas registradas (ya existe), insumos entregados (mover fuera de la rama ENTREGA), órdenes de mantenimiento (nuevas cards con estado/desc), cambios de impresoras (instalada/retirada en esta visita).
- Renombrar la sección informativa a "Impresoras activas del contrato" (deja de confundirse con un plan de instalación).
- **Completar visita** abre modal: resumen de actividades; si `readings`+`entregas`+`mantenimientos`+`cambios_impresoras` = 0 → textarea de motivo obligatorio; `POST /visits/{id}/complete` con `{motivo_cierre?}`.

### 2.3 `DeliveryPage.tsx`
`visitValida` = solo estado PENDIENTE/REPROGRAMADA (quitar checks y banners de `tipo_visita`).

### 2.4 Nueva `ReportFailurePage.tsx` + ruta
- Ruta `/visita/:id/falla` en `App.tsx`.
- Selecciona impresora de `visit.impresoras`, `desc_problema` obligatorio, foto opcional (reusar `lib/photo.ts`).
- `POST /maintenance-orders` con `{impresora_id, fecha: todayISO(), tipo_mantto: 'CORRECTIVO', desc_problema, visita_id}`.
- Banner online-only (patrón de DeliveryPage). Al éxito → volver al detalle (la visita NO se auto-completa).

### 2.5 `InstallationPage.tsx` / `RemovalPage.tsx`
Incluir `visita_id: visitId` en el payload de `assign-printer`/`release-printer`.

### 2.6 `mobile/README.md`
Actualizar alcance (motivo + actividades, reporte de falla, cierre con motivo, online-only).

## Fase 3 — Panel web (`frontend/src/`)

- `types/operations.ts`: agregar `motivo_cierre`, `mantenimientos`, `cambios_impresoras` al tipo Visit.
- `pages/operations/VisitDetailPage.tsx`: mostrar motivo de cierre, sección de entregas, órdenes de mantenimiento y cambios de impresoras; en el botón de completar (si existe; si no, agregarlo), solicitar `motivo_cierre` cuando no haya actividades (misma regla que la móvil).
- No hay cambios en calendario/creación de visitas.

## Fase 4 — Validación

```bash
docker compose exec app php artisan migrate
docker compose exec app php artisan test --filter="ArticleDeliveryTest|VisitCompletionTest|VisitSchedulingTest|SpontaneousVisitTest"
docker compose run --rm --no-deps mobile sh -c "npm run lint && npm run build"
docker compose run --rm --no-deps frontend sh -c "npm run build"
```

Smoke manual en `http://localhost:8080/m/` con `operador1@redprint.com` (Ctrl+F5):
visita LECTURA → entregar tóner → reportar falla → completar exige motivo solo si no hay actividades; visita INSTALACION → instalar → auto-completada con el cambio de impresora visible.

## Riesgos y notas

- Query JSON `datos_adicionales->visita_id` funciona en Postgres jsonb vía Laravel; cubrir con test.
- `complete` sobre visita COMPLETADA pasa de silencioso a 422 (cambio intencional; móvil/web ocultan el botón en estados no editables).
- Auto-completar INSTALACION/RETIRO solo aplica con `visita_id` y si la visita sigue editable (guard silencioso para segundas operaciones).
- Entregas en visitas sin contrato son válidas (`article_deliveries.contrato_id` nullable).
- `operador-inventario` (mvp1) sigue sin ver visitas: sin cambio de permisos.
- La cola offline y su dedup no se tocan.

## Fuera de alcance

Extender la cola offline a entregas/fallas, completar órdenes de mantenimiento desde móvil, planificación previa de impresoras/insumos por visita, facturación de entregas.
