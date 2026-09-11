# Plan Fase 2 — Botón "Actualizar" desde la app web

## Contexto (ya verificado, no volver a investigar)

- Fase 0+1 desplegadas y probadas en el VPS: orquestador `deploy/update.sh`, cron cada 1 min, update real completado (commit base `0c8b7d8`).
- Canal de archivos vivo: `storage/app/update/{request, status.json, version.json, update.log}` dentro del volumen `app_storage` (directorio propiedad de www-data; escrituras del host via tmp+mv symlink-safe).
- Regla de oro: **la app NUNCA ejecuta shell/docker** — solo escribe la bandera. El cron la reclama con `mv` (atómico, no sigue symlinks, no loguea contenido) y lanza el orquestador.
- `update.sh`: hace backup previo, `git pull --ff-only` con pre-flight de árbol limpio, short-circuit "sin cambios" si el último estado fue `listo`, y **re-encola la bandera** si llega pedido durante un update (FROM_CRON=1).
- Decisión de UI (usuario): tarjeta **"Actualización del Sistema" en ConfigPage**; la tarjeta fake "Información del Sistema" se convierte en datos reales de `version.json`.
- Decidido antes (ideas/despliegue-vps.md): permiso solo admin; SIN badge "desactualizado" (sin GitHub API); latencia cron ~60 s aceptada; ventana de servicio 1–3 min aceptada.
- `ConfigPage.tsx` es hoy un mock (localStorage + toasts falsos); su tarjeta de versión muestra datos hardcodeados → se vuelve real en este plan.
- Rebuild de dist en dev tras tocar `frontend/src`: `docker compose run --rm --no-deps frontend sh -c "npm run build"` (AGENTS.md). Para desplegar al VPS basta commit + push + `bash deploy/update.sh`.

## Tareas (en orden de ejecución)

### 1. Backend — catálogo y migración del permiso

1.1. `backend/config/permisos.php`: añadir al módulo `sistema` (tras `sistema.configuracion`):
     `['clave' => 'sistema.actualizar', 'etiqueta' => 'Actualizar sistema']`.

1.2. Nueva migración `backend/database/migrations/2026_09_11_000001_seed_permiso_sistema_actualizar.php`,
     patrón exacto de `2026_08_26_000003_create_field_records_table.php::seedPermission()`:
     - `Permission::firstOrCreate(['clave' => 'sistema.actualizar'], ['modulo' => 'sistema', 'etiqueta' => 'Actualizar sistema'])`.
     - Attach **solo al rol `administrador`** (NO a `operador`). Los roles `es_sistema` tienen bypass en `EnsurePermission`, pero el attach mantiene el catálogo consistente para la UI de roles.
     - `down()`: detach del rol + `delete()` del permiso (reversible e idempotente).

### 2. Backend — UpdateService (delgado, solo archivos)

2.1. Nuevo `backend/app/Services/UpdateService.php`:
     - Base: `storage_path('app/update')`; `ensureDir()` con `mkdir 0775 true` si falta.
     - `readJson(string $file): ?array` — `file_get_contents` + `json_decode`; null si falta o corrupto.
     - `estado(): string` — `'inactivo'` si no hay `status.json`; si no, el valor de `estado`.
     - `hayBandera(): bool`, `pedir(User $u): void` — lanza excepción de negocio si `estado === 'corriendo'` o la bandera ya existe; escribe `request` con `{"pedida_por_id":…, "pedida_por_email":…, "ts":"ISO-8601 UTC"}` (el cron NO loguea este contenido; es solo registro).
     - `version(): ?array` — `version.json`.
     - **Nunca escribe `status.json` ni borra archivos** (esos son del orquestador).

### 3. Backend — endpoints y auditoría

3.1. Nuevo `backend/app/Http/Controllers/System/UpdateController.php` (delgado, estilo `NotificationController`):
     - `request()` (POST): `UpdateService::pedir(auth()->user())`; además **primer escritor real de `audit_logs`**: `AuditLog::create(['usuario_id'=>…, 'accion'=>'sistema.actualizar.solicitada', 'entidad_tipo'=>'system', 'entidad_id'=>0, 'ip_origen'=>$request->ip(), 'user_agent'=>$request->userAgent(), 'fecha'=>now()])` (tabla existe: migración `0001_01_01_000014`; `usuario_id` nullable, `fecha` nullable). Devuelve **202** `{estado: 'en_cola'}`; **409** si en curso o en cola.
     - `status()` (GET): `{estado, rama, sha, inicio, fin, detalle, log}` — `log` = contenido de `update.log` (≤8 KB, ya limitado por el script) o null.
     - `version()` (GET): `{version: {...} | null}`.
3.2. `backend/routes/api.php` — sección Sistema (tras `sistema.notificaciones`), línea ~235:
     ```php
     Route::middleware('permission:sistema.actualizar')->group(function () {
         Route::post('system/update', [UpdateController::class, 'request']);
         Route::get('system/update/status', [UpdateController::class, 'status']);
         Route::get('system/update/version', [UpdateController::class, 'version']);
     });
     ```

### 4. Frontend — ConfigPage

4.1. Helpers en `frontend/src/lib/api.ts` (o `lib/system.ts`): `requestUpdate()`, `getUpdateStatus()`, `getUpdateVersion()` (axios existente; el POST ya pasa por el interceptor CSRF).
4.2. En `frontend/src/pages/admin/ConfigPage.tsx`:
     - **Reemplazar** la tarjeta "Información del Sistema" fake por datos reales de `getUpdateVersion()`: Versión = `sha` corto, Última actualización = `fin`/`fecha`, placeholders "—" si null.
     - **Nueva tarjeta "Actualización del Sistema"**, visible solo con `user.es_sistema || permisos.includes('sistema.actualizar')` (patrón `RequirePermission.tsx:25`):
       * Botón "Actualizar ahora" (deshabilitado si estado `corriendo`/`en cola`).
       * Modal de confirmación con `components/ui/Modal.tsx`, copy honesto: "Se respaldará la base de datos y la app puede tardar 1–3 minutos en volver (la sesión no se pierde). El sistema se actualizará al último commit de main."
       * Al 202 → polling cada 2 s de `getUpdateStatus()` hasta `listo|error`; limpiar interval en unmount.
       * Estados: `en_cola` → "Esperando al orquestador (hasta ~60 s)…"; `corriendo` → log en vivo en `<pre>` con auto-scroll (usar `log` del endpoint); `listo` → toast de éxito + hint "recarga con Ctrl+F5 para cargar la nueva versión"; `error` → mostrar tail del log + mensaje accionable "revisar /var/log/redprint/update.log por SSH".
       * **Tolerancia a la ventana de reinicio**: durante `up -d`/restart de php-fpm los polls fallan (502/conexión rechazada) → NO tratar como error fatal: mantener estado `corriendo` y reintentar. El interceptor de `api.ts` solo redirige a /login con 401 — 502 no lo dispara (verificado).
       * Al montar: consultar status una vez para reflejar una actualización iniciada desde otra pestaña/sesión (cubre el 409 del backend).
4.3. Opcional recomendado: badge de estado en la tarjeta (ui/Badge.tsx) con color por estado (`listo` neutro, `corriendo` ámbar, `error` rojo).

### 5. Tests backend

5.1. Nuevo `backend/tests/Feature/SystemUpdateTest.php` (patrón de `ArticleDeliveryTest`: crear rol + usuario, sincronizar permisos con `Permission::whereIn('clave', …)`):
     - Usuario sin `sistema.actualizar` → 403 en los tres endpoints.
     - Con permiso → POST 202 y `storage/app/update/request` existe con JSON parseable.
     - Doble POST con bandera presente → 409.
     - `GET status` sin archivos → `{estado: 'inactivo'}`.
     - `GET status` con `status.json` de ejemplo en el dir → devuelve los campos.
     - `GET version` sin archivo → `{version: null}`.
     - Entrada de audit_log creada tras POST (accion `sistema.actualizar.solicitada`).
     - Tests corren con migraciones (RefreshDatabase) → la migración del permiso se valida sola.

### 6. Despliegue y validación end-to-end (dogfooding)

6.1. Commit + push desde dev (`bash -n` a los scripts NO aplica; correr tests: `docker compose exec app php artisan test --filter=SystemUpdateTest`).
6.2. En el VPS: `bash deploy/update.sh` — aplica la migración (siembra el permiso) y recompila dists automáticamente.
6.3. Validar en producción:
     - Login admin → ConfigPage muestra versión real (`0c8b7d8` o el sha del deploy).
     - **Primer disparo desde el botón**: short-circuit "sin cambios" → termina en segundos con `listo` (válido e idempotente).
     - Disparo real: hacer un commit trivial y actualizar de nuevo desde la UI, observando `en_cola` → `corriendo` → `listo` y que la sesión sobrevive.
     - Doble pestaña: segundo POST → 409.
     - `GET audit-log` (sistema.usuarios) muestra la entrada.
     - Mañana: `ls -l /root/backups` confirma el backup del disparo.

## Riesgos y mitigaciones

- **php-fpm se reinicia a mitad del update** → polls fallan → la UI mantiene `corriendo` y reintenta (4.2); no hay redirección a login.
- **La SPA se reconstruye** → los assets viejos desaparecen de `dist`; la página ya cargada sigue viva en memoria; tras `listo` se sugiere recarga dura.
- **Bandera escrita pero cron muerto** → `en_cola` indefinido → hint en UI: "si no cambia en ~2 min, verificar `crontab -l` y `/var/log/redprint/cron.log`".
- **Primer escritor de audit_logs** → columnas nullable ya cubiertas; probar en tests.
- **POST concurrentes** → 409 por bandera existente; y aunque se colaran dos, el `flock` del orquestador los serializa y el segundo re-encola.

## Fuera de scope (explícito)

- Badge "desactualizado" / comparación con GitHub API (v3, ideas §9.3).
- Modo mantenimiento `artisan down` (ideas §9.2).
- Página dedicada de sistema (solo tarjetas en ConfigPage).
- Botón en el Header.

## Archivos tocados (referencia)

| Superficie | Archivo |
|---|---|
| Catálogo permiso | `backend/config/permisos.php` |
| Migración permiso | `backend/database/migrations/2026_09_11_000001_seed_permiso_sistema_actualizar.php` (nuevo) |
| Servicio | `backend/app/Services/UpdateService.php` (nuevo) |
| Endpoints | `backend/app/Http/Controllers/System/UpdateController.php` (nuevo) + `backend/routes/api.php` |
| Auditoría | `backend/app/Models/AuditLog.php` (uso, sin cambios) |
| UI | `frontend/src/pages/admin/ConfigPage.tsx` (+ `frontend/src/lib/api.ts`) |
| Tests | `backend/tests/Feature/SystemUpdateTest.php` (nuevo) |
| Sin cambios | `deploy/*`, `docker-compose.yml`, entrypoint |
