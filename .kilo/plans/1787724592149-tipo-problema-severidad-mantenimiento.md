# Plan: Campos `tipo_problema` y `severidad` en órdenes de mantenimiento

## Objetivo

Replicar la UX del prototipo (`prototipoMovile`, vista "Reportar Problema") en la app real:
mobile captura **tipo de problema** y **severidad** al reportar una falla; el backend los
almacena y expone; el panel web los muestra como badges. El formulario web de nueva orden
**no** cambia.

## Decisiones confirmadas (con el usuario)

1. **Alcance**: mobile + API + panel web (solo lectura en web).
2. **Valores** (español mayúsculas, convención del código):
   - `tipo_problema`: `NO_IMPRIME`, `CALIDAD_DEFICIENTE`, `ATASCOS`, `ERROR_PANTALLA`, `OTRO`
   - `severidad`: `BAJA`, `MEDIA`, `ALTA`, `CRITICA`
3. **Obligatoriedad**: columnas y validación API **nullable** (compatible con órdenes
   existentes y con el alta web que no las envía). **Mobile las exige en la UI**
   (botón deshabilitado hasta elegir ambas, como el prototipo).
4. **Severidad CRITICA no dispara nada** en v1 (sin notificaciones/SLA). Fuera de alcance.

## Contexto relevante

- Tabla: `maintenance_orders` (migración `0001_01_01_000018`). Columnas nuevas vía
  migración incremental.
- Enums existentes: string-backed, nombres en inglés (`MaintenanceType`, `MaintenanceStatus`).
  Los nuevos siguen esa convención: `ProblemType`, `ProblemSeverity`.
- El reporte de falla de mobile es **online-only** (no usa la cola offline), así que no hay
  cambios en `sync.ts`/`db.ts`.
- Modelos/recursos a tocar:
  - Backend: `app/Models/MaintenanceOrder.php`, `app/Http/Requests/Store|UpdateMaintenanceOrderRequest.php`,
    `app/Http/Resources/MaintenanceOrderResource.php`, `app/Http/Controllers/MaintenanceOrderController.php`,
    `database/seeders/MaintenanceOrderSeeder.php`.
  - Mobile: `src/pages/ReportFailurePage.tsx`, `src/types/api.ts`.
  - Web: `src/types/maintenance-order.ts`, `src/types/operations.ts`,
    `src/pages/inventory/maintenance/MaintenanceList.tsx` y `MaintenanceDetail.tsx`,
    `src/pages/operations/VisitDetailPage.tsx`.

## Tareas

### 1. Backend: enums

- `backend/app/Enums/ProblemType.php` (string-backed): casos del punto 2 de decisiones.
- `backend/app/Enums/ProblemSeverity.php` (string-backed): ídem.

### 2. Backend: migración

Nueva migración `add_problem_fields_to_maintenance_orders_table`:
- `$table->string('tipo_problema')->nullable()` tras `desc_problema`
- `$table->string('severidad')->nullable()` tras `tipo_problema`
- Índices simples sobre ambas columnas (futuros filtros/estadísticas).
- `down()`: dropColumn + dropIndex.

### 3. Backend: modelo y servicio

- `MaintenanceOrder`: agregar `tipo_problema`, `severidad` a `$fillable`; casts a
  `ProblemType::class` y `ProblemSeverity::class`.
- `MaintenanceService::create` no requiere cambios (mass-assignment pasa los campos por
  `$request->validated()`).

### 4. Backend: validación y API

- `StoreMaintenanceOrderRequest` y `UpdateMaintenanceOrderRequest`: reglas
  `'tipo_problema' => 'nullable|in:NO_IMPRIME,CALIDAD_DEFICIENTE,ATASCOS,ERROR_PANTALLA,OTRO'`
  y `'severidad' => 'nullable|in:BAJA,MEDIA,ALTA,CRITICA'` (o `Rule::enum(...)`).
- `MaintenanceOrderResource`: exponer `tipo_problema` y `severidad` (`?->value ?? null`,
  mismo patrón que `tipo_mantto`).
- `MaintenanceOrderController::index`: filtros opcionales `tipo_problema` y `severidad`
  (mismo patrón que `estado`/`tipo_mantto`), y agregarlas al array de columnas ordenables.

### 5. Backend: seeder

- `MaintenanceOrderSeeder`: para órdenes CORRECTIVO asignar `tipo_problema` y `severidad`
  aleatorios (mapear cada descripción correctiva a un tipo coherente); PREVENTIVO las deja
  en null.

### 6. Mobile: tipos y captura

- `mobile/src/types/api.ts`: en `MaintenanceOrder` agregar
  `tipo_problema: string | null` y `severidad: string | null`.
- `mobile/src/pages/ReportFailurePage.tsx`:
  - Estado `tipoProblema` y `severidad` (nullable).
  - Grid de **tipo de problema** con 5 Cards seleccionables (iconos del prototipo:
    🖨️ No imprime, 📄 Calidad deficiente, 📎 Atascos, ⚠️ Error en pantalla, ❓ Otro),
    estilo idéntico al de selección de impresora (border azul + ✓).
  - Grid de **severidad** con 4 botones tipo Chip coloreados:
    Baja=emerald, Media=amber, Alta=red, Crítica=red fuerte/borde oscuro.
  - `canSubmit` exige `tipoProblema && severidad && descValida && printerId && online`.
  - POST `/maintenance-orders` incluye `tipo_problema` y `severidad`.
  - En la sección "Ya reportado en esta visita", mostrar badges de tipo y severidad
    (tonos: Baja=emerald, Media=amber, Alta=red, Crítica=red) usando `Badge` de `ui.tsx`.
  - Ambos grids van sobre el formulario de descripción, bajo la tarjeta de impresora
    seleccionada (mismo orden visual que el prototipo).

### 7. Web: tipos y visualización

- `frontend/src/types/maintenance-order.ts` y `frontend/src/types/operations.ts`: agregar
  `tipo_problema: string | null` y `severidad: string | null`.
- `MaintenanceList.tsx`: columna "Problema" con label legible del tipo + badge de severidad
  (solo si existen). Añadir al filtro/tipo de columna siguiendo el patrón existente.
- `MaintenanceDetail.tsx`: en el bloque de datos de la orden, filas "Tipo de problema" y
  "Severidad" (label legible + badge de color).
- `operations/VisitDetailPage.tsx`: en la sección de mantenimientos de la visita, añadir
  los badges junto al tipo de mantenimiento existente.
- Mapas compartidos de labels y tonos (BAJA=verde, MEDIA=ámbar, ALTA=rojo, CRÍTICA=rojo
  intenso) definidos una vez por archivo o en un helper pequeño del frontend.

### 8. Pruebas backend

Nuevo test feature `backend/tests/Feature/MaintenanceProblemFieldsTest.php`:
- Store con `tipo_problema`+`severidad` válidos → persistidos y devueltos por la API.
- Store con valor inválido → 422.
- Store sin los campos → 201 (nullable, compatibilidad alta web).
- Index filtra por `severidad`.
- Verificar que el printer pasa a EN_MANTENIMIENTO como antes (sin regresión).

### 9. Migración y seed

```bash
docker compose exec app php artisan migrate
docker compose exec app php artisan db:seed --class=MaintenanceOrderSeeder   # solo si se re-seedea; el seeder actual crea 30 órdenes nuevas cada corrida — valorar truncar antes o solo aplicar a datos nuevos
```

> Nota: el seeder no es idempotente (siempre inserta 30). No re-ejecutar sobre datos
> existentes salvo que el usuario lo pida.

### 10. Builds y verificación

```bash
# Backend
docker compose exec app php artisan test --filter=MaintenanceProblemFieldsTest
docker compose exec app php artisan test   # suite completa (regresiones)

# Mobile (incluye tsc --noEmit)
docker compose run --rm --no-deps mobile sh -c "npm run build"

# Frontend web (incluye tsc si el build lo hace; si no, correr typecheck del proyecto)
docker compose run --rm --no-deps frontend sh -c "npm run build"
```

- Prueba manual en `http://localhost:8080/m/`: reportar falla desde una visita → grid de
  tipo + severidad, botón habilitado solo con todo elegido, orden creada.
- Prueba manual en panel web: lista/detalle de mantenimiento y detalle de visita muestran
  los badges; crear una orden correctiva desde la web sigue funcionando sin los campos.

## Riesgos y mitigaciones

- **Regresión en alta web**: validación nullable lo evita (cubierto por test).
- **Casts de enum con valores legacy**: columnas nuevas, no hay datos previos → sin riesgo.
- **Seeder no idempotente**: no re-ejecutar (ver nota en tarea 9).

## Fuera de alcance (v1)

- Notificaciones/alertas por severidad CRITICA.
- Captura de tipo/severidad en el formulario web de nueva orden.
- Filtros por tipo/severidad en la UI del panel web (la API ya los soporta).
- Campos extra del prototipo: "¿Requiere visita técnica?" y "Adjuntar foto".
