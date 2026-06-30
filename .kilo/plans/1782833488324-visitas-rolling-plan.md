# Plan: Visitas recurrentes automáticas (rolling) + CRUD manual + contratos sin fin fijo

## Contexto

RedPrint modela "visitas programadas" como filas en `visits` con `estado=PENDIENTE` y
`fecha_programada`. El análisis del módulo revela:

- No existe automatismo de generación: no hay `app/Console/`, ni `Schedule`, ni observers.
- `VisitSchedulerService::generateRecurringVisits()` está diseñado para generar **todas** las
  visitas de golpe (hasta `fecha_fin`, o 6 meses si es indefinido) pero **nunca se invoca**.
- El contrato guarda `frecuencia_visitas` y `dias_adelanto` que no se usan para generar visitas.
- El modal "Nueva visita" del frontend **no llama a la API** (solo cierra el modal); el hook
  `useCreateVisit` está definido pero sin usar.
- Los botones "Editar"/"Eliminar" de `VisitDetailPage` no tienen `onClick`.
- El select de `socio_asignado` en `CalendarPage` está *hardcodeado*.
- Desincronización tipos TS ↔ `VisitResource`: el frontend espera `cliente_nombre`,
  `hora_programada`, `socio_asignado`, `impresoras[]` que el backend no entrega.

**Objetivo:** contratos permanentes (sin `fecha_fin`) con día de visita fijo, visitas recurrentes
generadas automáticamente en modo *rolling* (1 mes por delante), y CRUD manual de visitas
funcional para los casos excepcionales (INSTALACION/RETIRO/MANTENIMIENTO/LECTURA extra).

## Decisiones de diseño (aprobadas)

1. **Día de visita:** nuevo campo `dia_visita` (entero 1–31, nullable) en `contracts`.
2. **Ventana rolling:** el cron genera **1 mes por delante** (solo el próximo ciclo).
3. **Frecuencia del job:** **diario** (02:00). Idempotente vía guard anticopia.
4. **Cancelación de contrato:** visitas futuras PENDIENTES → estado `CANCELADA` (no se borran);
   el cron deja de generar para ese contrato.
5. Semántica de `dia_visita`: aplica a **MENSUAL** (día del mes). Para **QUINCENAL/SEMANAL** la
   fecha se deriva desde `fecha_inicio` (sumando 2 semanas / 1 semana). Meses sin ese día (p. ej.
   día 31 en febrero) → *clamp* al último día válido del mes.
6. **Coexistencia:** el cron solo crea `LECTURA` recurrente; manual crea cualquier tipo. Guard
   anticopia evita duplicados por (contrato_id, fecha_programada).
7. Generación se invoca también al **crear** contrato (la 1ª visita aparece sin esperar al cron).

## Fuera de alcance (trabajo separado)

- Campos `hora_programada`, `duracion_estimada`, `direccion_cliente` (requieren migración de
  `visits`).
- Relación directa `visits ↔ printers` (hoy se infiere vía `readings`/`contract_printer`).
- `impresoras[]` en el `Visit` del frontend.

---

## Tareas

### A. Backend — Contratos

1. **Migración** `database/migrations/xxxx_add_dia_visita_to_contracts_table.php`:
   añade `dia_visita` (integer nullable, rango implícito 1–31 validado en app).
2. **`app/Models/Contract.php`:** añadir `dia_visita` a `$fillable` y `$casts` (integer, nullable).
3. **`app/Services/ContractService.php`:**
   - `store`/`update`: validar `dia_visita` ∈ [1,31] (o null). Incluirlo en la creación.
   - En `store`: tras crear el contrato ACTIVO, invocar generación de la próxima visita
     (`VisitSchedulerService`).
   - En `update`/`cancel`: al pasar el contrato a `CANCELADO` o `FINALIZADO`, marcar como
     `CANCELADA` todas las visitas `PENDIENTES` futuras (`fecha_programada >= hoy`) de ese contrato.
4. **Request de validación** del contrato (si existe `StoreContractRequest`/`UpdateContractRequest`):
   añadir regla `'dia_visita' => 'nullable|integer|between:1,31'`.

### B. Backend — Generación automática rolling

5. **Reescribir `app/Services/VisitSchedulerService.php`:**
   - Nuevo método `generateNextCycle(Contract $contract): ?Visit` que crea **solo la próxima**
     visita `LECTURA` según frecuencia y `dia_visita`, si no existe ya (guard anticopia por
     `contrato_id` + `fecha_programada` + cliente). Respeta *clamp* de mes corto.
   - Nuevo método `cancelFutureVisits(Contract $contract): int` para marcar futuras como CANCELADA.
   - Reescribir `generateRecurringVisits()` para que itere contratos ACTIVOS y llame a
     `generateNextCycle()` (ya no "6 meses de golpe").
   - Calcular `nextDate`: si existe al menos una visita futura PENDIENTE para el contrato dentro
     de la ventana de 1 mes → no crear nada. Sino, crear la del próximo día de visita a partir de
     hoy.
6. **Crear `app/Console/Kernel.php`** (no existe) con `Schedule`:
   `$schedule->command('visits:generate-upcoming')->dailyAt('02:00');`
   (Seguir convención Laravel: si el proyecto usa `bootstrap/app.php` scheduling, usar esa vía;
   verificar versión de Laravel antes — ver "Notas de implementación").
7. **Crear command** `app/Console/Commands/GenerateUpcomingVisits.php`:
   - Firma `visits:generate-upcoming`.
   - Recorre `Contract` donde `estado=ACTIVO` y (`fecha_fin` null o `>= hoy`) → `generateNextCycle`.
   - Log por consola de cuántas creó / omitió.

### C. Backend — API de visitas (alineación mínima)

8. **`app/Http/Resources/VisitResource.php`:** exponer `cliente_nombre` (de `client`) y
   `socio_nombre` (de `socio`) para que el frontend no use datos inexistentes. No añadir
   `hora_programada`/`impresoras[]` (fuera de alcance).
9. **`app/Http/Controllers/VisitController.php`:** confirmar que `store`/`update`/`destroy` ya
   existen (apiResource) y que `destroy` respeta autorización. Sin cambios si ya funcionan.

### D. Frontend — CRUD manual funcional

10. **`frontend/src/pages/operations/calendar/CalendarPage.tsx`:**
    - Conectar el botón "Guardar" del modal "Nueva visita" al hook `useCreateVisit`.
    - Reemplazar el select *hardcodeado* de socio por datos reales (endpoint de usuarios/socios;
      si no existe, añadir `GET /users?role=...` mínimo o reutilizar el existente).
    - Reemplazar el input de texto "ID del cliente" por un selector de cliente real.
11. **`frontend/src/pages/operations/VisitDetailPage.tsx`:**
    - Cablear botón "Editar" → modal/form usando `PUT /visits/{id}` (campos permitidos:
      `fecha_programada`, `socio_id`, `notas`).
    - Cablear botón "Eliminar" → `DELETE /visits/{id}` con confirmación.
12. **`frontend/src/hooks/useVisits.ts`:** añadir `useUpdateVisit` y `useDeleteVisit` (si no existen).
13. **`frontend/src/types/operations.ts`:** alinear tipo `Visit` con lo que entrega el backend tras
    el cambio del `VisitResource` (añadir `cliente_nombre`, `socio_nombre`; mantener opcionales los
    campos fuera de alcance para no romper compilación).

### E. Form de contrato (frontend)

14. **Formulario de creación/edición de contrato** (localizar el componente de contrato en
    `frontend/src/pages`): añadir selector "Día de visita del mes" (1–31, o vacío). Enviar
    `dia_visita` al backend.

### F. Tests / Validación

15. **Feature test backend** (`tests/Feature/VisitSchedulingTest.php`):
    - Crear contrato hoy (2026-06-30) ACTIVO, `frecuencia_visitas=MENSUAL`, `dia_visita=15` →
      existe visita 2026-07-15 PENDIENTE (generada al crear).
    - Ejecutar `visits:generate-upcoming` de nuevo → **no duplica** (idempotente).
    - Pasar contrato a `CANCELADO` → visitas futuras PENDIENTES = `CANCELADA`.
    - Caso mes corto: `dia_visita=31` con frecuencia MENSUAL → próxima visita en febrero usa día 28/29.
16. **Smoke manual (Docker):**
    - `docker compose exec app php artisan migrate`
    - `docker compose exec app php artisan test --filter=VisitSchedulingTest`
    - `docker compose exec app php artisan visits:generate-upcoming` (ver output)
    - Recompilar front: `docker compose run --rm --no-deps frontend sh -c "npm run build"` y
      verificar en `http://localhost:8080` (Ctrl+F5).

---

## Notas de implementación

- **Versión de Laravel / Scheduler:** antes de crear `Console/Kernel.php`, verificar la versión
  (Laravel 11 usa `routes/console.php` + `Schedule` facade en `bootstrap/app.php`; Laravel <=10
  usa `app/Console/Kernel.php`). Elegir la forma idiomática del proyecto.
- **Tz/hora:** el job corre en la timezone del servidor Docker; documentar.
- **No usar `rm -rf dist`:** respetar el script de build del frontend (vacía sin borrar carpeta)
  para evitar el 500 de nginx por bind mount (Windows + Docker).
- **`config:cache`:** si se añaden rutas/comandos, ejecutar
  `docker compose exec app php artisan config:cache` tras cambios de config.

## Riesgos

- **Duplicados:** mitigados por guard anticopia (contrato_id + fecha_programada). El test de
  idempotencia lo cubre.
- **Contratos creados antes de la migración:** `dia_visita` nullable → el cron debe tratar
  `dia_visita` null derivando desde `fecha_inicio` (no fallar).
- **Cambio de `dia_visita` a mitad de relación:** no re-genera pasadas; solo afecta al próximo
  ciclo. Documentar.
- **Cancelar reactiva:** si un contrato CANCELADO vuelve a ACTIVO, el cron reanuda generación (las
  visitas CANCELADAS previas no se restauran; se crean nuevas). Aceptable.

## Archivos clave afectados

- `backend/database/migrations/*_add_dia_visita_to_contracts_table.php` (nuevo)
- `backend/app/Models/Contract.php`
- `backend/app/Services/ContractService.php`
- `backend/app/Services/VisitSchedulerService.php`
- `backend/app/Console/Kernel.php` o `backend/routes/console.php` (nuevo)
- `backend/app/Console/Commands/GenerateUpcomingVisits.php` (nuevo)
- `backend/app/Http/Resources/VisitResource.php`
- `backend/app/Http/Controllers/VisitController.php`
- `backend/app/Http/Requests/StoreContractRequest.php` / `UpdateContractRequest.php`
- `backend/tests/Feature/VisitSchedulingTest.php` (nuevo)
- `frontend/src/pages/operations/calendar/CalendarPage.tsx`
- `frontend/src/pages/operations/VisitDetailPage.tsx`
- `frontend/src/hooks/useVisits.ts`
- `frontend/src/types/operations.ts`
- Componente de formulario de contrato (a localizar en `frontend/src/pages`)
