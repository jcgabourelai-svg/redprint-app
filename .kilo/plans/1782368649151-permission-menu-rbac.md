# Plan: Sistema de Permisos por Opciones de Menú (RBAC por rol)

> Objetivo: permitir salir a producción con un MVP acotado. Un usuario con un rol
> limitado (ej. "Operador Inventario") ve y accede únicamente a las opciones de menú
> que su rol tiene asignadas; el resto queda oculto en el menú, bloqueado en la ruta
> del frontend y devuelve 403 en la API. No se eliminan opciones de menú existentes;
> se controla su visibilidad/acceso por permisos.

## Contexto actual (verificado en código)

- Menú hardcoded en `frontend/src/components/layout/Sidebar.tsx` (`navItems`, líneas 33-103) y **duplicado** en `frontend/src/components/layout/BottomNav.tsx`. Sin filtrado por rol.
- Roles = 2 fijos: `backend/app/Enums/UserRole.php` (`ADMIN`/`OPERADOR`), guardados como string en `users.rol` (cast a enum en `User.php`).
- **No existen** tablas/modelos de permisos ni módulos.
- Control de acceso: middleware `role:ADMIN` (`backend/app/Http/Middleware/EnsureUserRole.php`, alias `role` en `bootstrap/app.php`) aplicado **ruta por ruta** en `backend/routes/api.php`. El frontend **no protege rutas ni filtra el menú**; solo usa `useIsAdmin()` (`frontend/src/contexts/AuthContext.tsx`) para ocultar botones sueltos.
- `/auth/user` (`AuthController::user`) devuelve el modelo `User` crudo. `/users` usa `UserResource`.
- `useUsers.ts` mapea `rol` del backend; `UserListPage.tsx` usa Tabs con una sola pestaña y un `<Select>` fijo ADMIN/OPERADOR.
- Migraciones numeradas `0001_01_01_0000XX`; la última es `..._000031`. Próximas: `000032`+.
- Entorno: TODO en Docker, la app se sirve en **http://localhost:8080**. Tras cambios de frontend hay que recompilar `dist` en Docker (ver AGENTS.md). Backend: editar código + `php artisan config:cache` si cambia config/rutas.

## Decisiones de diseño (confirmadas)

1. **Granularidad**: 1 permiso por opción de menú = acceso completo (ver + editar dentro de ese módulo). ~22 permisos. No hay split `.ver`/`.editar`.
2. **Rol sistema (bypass total)**: flag `es_sistema` en el rol. Quien lo tiene pasa TODOS los chequeos automáticamente. Los 3 usuarios admin actuales conservan acceso total sin asignar permisos uno a uno.
3. **Dashboard**: siempre accesible; cada widget/sección se renderiza solo si el usuario tiene el permiso del módulo. MVP1 vería solo inventario.
4. **Gestor de roles**: nueva pestaña **"Roles"** dentro de `UserListPage` (ya usa `Tabs`). Sección renombrada a "Usuarios y Roles".
5. **Módulo = agrupador cosmético** (`permissions.modulo`), nunca unidad de exclusión de código.

## Catálogo de permisos (fuente única: `config/permisos.php`)

Estructura: cada entrada `{ clave, etiqueta }` dentro de un grupo `modulo`.

| modulo | claves |
|---|---|
| inventario | `inventario.impresoras`, `inventario.articulos`, `inventario.mantenimiento`, `inventario.almacenes`, `inventario.movimientos` |
| clientes | `clientes` |
| contratos | `contratos` |
| operaciones | `operaciones.calendario`, `operaciones.lecturas` |
| finanzas | `finanzas.facturas`, `finanzas.cuentas-por-cobrar`, `finanzas.cuentas-por-pagar`, `finanzas.compras`, `finanzas.rentabilidad`, `finanzas.flujo-caja`, `finanzas.cuentas-bancarias`, `finanzas.conciliacion`, `finanzas.cierre` |
| sistema | `sistema.usuarios`, `sistema.notificaciones`, `sistema.configuracion` |

> Dashboard (`/`) no requiere permiso de acceso (siempre visible); sus widgets sí se filtran.

---

## Fase 1 — Backend: modelo de datos

### Tarea 1.1 — Crear `config/permisos.php`
Devolver un array asociativo `modulo => [['clave'=>...,'etiquetiqueta'=>...], ...]` con el catálogo de arriba. Es la **fuente única de verdad** (la leen la migración/seed, el `Permission` model y el endpoint `GET /permisos`).

### Tarea 1.2 — Migración `0001_01_01_000032_create_rbac_tables.php`
En **una sola migración** crear:
- `roles`: `id`, `nombre`, `slug` (unique), `descripcion` (nullable), `es_sistema` (bool, default false), timestamps.
- `permissions`: `id`, `clave` (unique), `modulo`, `etiqueta`, `descripcion` (nullable), timestamps.
- `permission_role` (pivote): `role_id`, `permission_id`, PK compuesta `(role_id,permission_id)`, timestamps.

Y **sembrar dentro de la misma migración** (idempotente con `updateOrCreate`/`firstOrCreate`), para que los roles existan antes del mapeo de usuarios:
- Insertar todos los permisos leyendo `config('permisos')`.
- Crear rol `Administrador` (`slug='administrador'`, `es_sistema=true`).
- Crear rol `Operador` (`slug='operador'`, `es_sistema=false`) y asignarle **todos** los permisos (preserva conducta actual del OPERADOR que ve todo).
- Asignar **todos** los permisos al rol `Administrador` también (redundancia intencional; el bypass ya lo cubre, pero facilita inspección).

> Hacerlo en la migración (no en un seeder) garantiza que existan al mapear usuarios existentes, incluso en DB con datos previos.

### Tarea 1.3 — Migración `0001_01_01_000033_add_rol_id_to_users_table.php`
- Añadir `rol_id` (unsignedBigInteger, nullable) + FK → `roles(id)` (onDelete restrict/set null según preferencia; usar `set null` para no romper si se borra un rol).
- **Mapear datos existentes** (antes de eliminar la columna `rol`):
  - `rol='ADMIN'` → id de rol `Administrador`.
  - `rol='OPERADOR'` (o cualquier otro/null) → id de rol `Operador`.
- Eliminar la columna `rol` (end state limpio). Verificar que ningún código la lea tras la Fase 2.

### Tarea 1.4 — Modelos
- `Role` (App\Models): fillable `nombre, slug, descripcion, es_sistema`; relación `permissions()` belongsToMany; método `tienePermiso(string $clave): bool` (si `es_sistema` → true).
- `Permission` (App\Models): fillable `clave, modulo, etiqueta`; relación `roles()` belongsToMany.
- `User` (App\Models):
  - Quitar `'rol' => UserRole::class` del cast; añadir `rol_id` a `$fillable`.
  - Relación `role()` belongsTo `Role`.
  - Reimplementar `isAdmin(): bool` → `return (bool) ($this->role?->es_sistema);` (mantiene compat con `authorize()` y `useIsAdmin`). Reimplementar/eliminar `isOperador()`.
  - `permisos(): array` → si `es_sistema`: todas las claves de `config('permisos')`; si no, `$this->role->permissions->pluck('clave')->all()`. Cache en memoria (propiedad) por request.
  - `tienePermiso(string $clave): bool` → `in_array($clave, $this->permisos(), true)`.

---

## Fase 2 — Backend: middleware, auth y rutas

### Tarea 2.1 — Middleware `permission:`
Nuevo `app/Http/Middleware/EnsurePermission.php`: variadic `...$claves`; pasa si `$user->tienePermiso` de **alguna**. Registrar alias **`permission`** en `bootstrap/app.php` (junto al `role` existente). Devuelve 401 si no autenticado, 403 si no autorizado.

### Tarea 2.2 — `/auth/user` expone permisos
`AuthController::user()` devolver `array_merge($user->toArray(), ['permisos' => $user->permisos(), 'rol_id' => ..., 'rol_nombre' => ..., 'es_sistema' => ...])` (o un pequeño array estructurado). El frontend necesita `permisos: string[]`.

### Tarea 2.3 — `UserResource` + requests
- `UserResource::toArray`: reemplazar `'rol' => $this->rol?->value` por `rol_id`, `rol_nombre`, `es_sistema` (cargar relación `role`).
- `StoreUserRequest` / `UpdateUserRequest`: cambiar validación `'rol' => ...in:ADMIN,OPERADOR` por `'rol_id' => 'required|exists:roles,id'`. Mantener `authorize()` con `isAdmin()` (ahora vía es_sistema) o `tienePermiso('sistema.usuarios')`.
- `UserController::store/update`: ya usan `validated()`, funcionan al cambiar el request.

### Tarea 2.4 — Reemplazar `role:ADMIN` por agrupaciones `permission:`
Reorganizar `routes/api.php` agrupando por módulo. **Mapeo endpoint → permiso** (el dashboard queda abierto):

| Permiso | Endpoints (`/v1/...`) |
|---|---|
| `inventario.impresoras` | `printers`*, `printers/{id}/history`, `printer-expenses` |
| `inventario.articulos` | `articles`*, `articles/{id}/movements`, `articles/{id}/compatible-printers` |
| `inventario.movimientos` | `inventory-movements` |
| `inventario.mantenimiento` | `maintenance-orders`*, `reports/maintenance/*` |
| `inventario.almacenes` | `warehouses`* |
| `clientes` | `clients` |
| `contratos` | `contracts`*, `contracts/{id}/{assign,release}-printer` |
| `operaciones.calendario` | `visits`* |
| `operaciones.lecturas` | `readings`* |
| `finanzas.facturas` | `invoices`, `payments` |
| `finanzas.cuentas-por-pagar` | `supplier-payments` |
| `finanzas.compras` | `purchases`*, `suppliers`* |
| `finanzas.rentabilidad` | `reports/finance/profitability`, `reports/finance/client-profitability` |
| `finanzas.flujo-caja` | `reports/finance/cash-flow` |
| `finanzas.cuentas-bancarias` | `bank-accounts`* |
| `finanzas.conciliacion` | `reconciliation/*` |
| `finanzas.cierre` | `period/*` |
| `sistema.usuarios` | `users`* (y `audit-log`) |
| `sistema.notificaciones` | `notifications` |
| (abierto) | `dashboard`, `auth/*` |

`*` = apiResource (aplicar el `permission:` al grupo entero del recurso). Los endpoints de roles/permisos (Tarea 2.5) quedan tras `permission:sistema.usuarios`. Quitar todos los `->middleware('role:ADMIN')` sueltos.

### Tarea 2.5 — `RoleController` + `GET /permisos`
- `app/Http/Http/Controllers/RoleController.php` ( CRUD): `index`, `store`, `update`, `destroy` (no permitir borrar/editar `es_sistema=true` salvo quizá editar nombre). `sync('permisos', $claves)` al crear/actualizar.
- `StoreRoleRequest`/`UpdateRoleRequest`: `nombre` required, `permisos` array de claves válidas (regla `in:` claves del catálogo).
- `RoleResource`: id, nombre, slug, es_sistema, descripcion, permisos[].
- Endpoint extra `GET /permisos` → devuelve `config('permisos')` agrupado (para la UI de checkboxes).
- Rutas (dentro de `auth:sanctum` + `permission:sistema.usuarios`): `GET/POST /roles`, `PUT/DELETE /roles/{role}`, `GET /permisos`.

### Tarea 2.6 — Seeders
- Actualizar `UserSeeder`: asignar `rol_id` (los admin actuales → rol Administrador; operadores → Operador). Hacer idempotente (`firstOrCreate` por correo).
- Añadir `RolePermissionSeeder` (idempotente) que cree el **rol "Operador Inventario"** (`slug='operador-inventario'`, `es_sistema=false`) con permisos `inventario.impresoras`, `inventario.almacenes`, `inventario.articulos` **únicamente**, y el usuario **`mvp1@redprint.com`** (pass `password`, asignado a ese rol). Registrar en `DatabaseSeeder`.

---

## Fase 3 — Frontend: permisos en auth + menú + rutas

### Tarea 3.1 — Tipos y contexto
- `frontend/src/types/admin.ts`: `User` añade `permisos: string[]`, `rol_id`, `rol_nombre`, `es_sistema`. (Mantener `rol` opcional por compat o eliminar y limpiar usos.)
- `AuthContext`: mapear `permisos` en la respuesta de `/auth/user`. Exponer `useTienePermiso(clave): boolean` (`permisos.includes(clave)`). Reimplementar `useIsAdmin()` → `es_sistema` (mantiene usos existentes).

### Tarea 3.2 — Catálogo de menú compartido (desduplicar Sidebar/BottomNav)
Crear `frontend/src/config/nav.ts` exportando el `navItems` (mismo árbol actual) con un campo nuevo **`permiso?: string`** en cada hoja. Padre sin permiso propio (se muestra si **alguna** hoja visible). Dashboard sin `permiso`. `Sidebar.tsx` y `BottomNav.tsx` lo importan en vez de redefinirlo.

Asignación `permiso` por hoja (igual a las claves del catálogo): impresoras→`inventario.impresoras`, etc. Clientes/Contratos (hojas) → `clientes`/`contratos`.

### Tarea 3.3 — Filtrado del menú por permisos
- En `Sidebar.tsx`: filtrar `navItems` con `useTienePermiso`; un padre se muestra si ≥1 hoja visible; las hojas se filtran individualmente. El usuario de la tarjeta inferior (líneas 293-310) hoy es "Juan Pérez" hardcoded: dejar o leer del `useAuth()` (opcional, fuera del scope crítico).
- `BottomNav.tsx`: mismo filtrado; si un ítem superior no tiene hojas visibles, ocultarlo.

### Tarea 3.4 — Guard de rutas `<RequirePermission>`
Crear `frontend/src/components/auth/RequirePermission.tsx`: recibe `permiso`, si no cumple → `<Navigate to="/" replace />` (o página "No autorizado"). Envolver cada `<Route>` de `App.tsx` con su permiso (dashboard y login fuera). Esto tapa el **hueco de seguridad actual** (hoy se entra por URL a cualquier módulo).

### Tarea 3.5 — Pestaña "Roles" en `UserListPage`
- Hook `useRoles` + `usePermisosCatalog` + mutaciones (`useCreateRole`, `useUpdateRole`, `useDeleteRole`) en `frontend/src/hooks/useRoles.ts` (patrón de `useUsers.ts`).
- Añadir segunda pestaña `{ id: 'roles', label: 'Roles', content: rolesTab }` al `<Tabs>`.
- `rolesTab`: tabla de roles (nombre, # permisos, es_sistema badge) + botón "Nuevo rol". Modal de edición con checkboxes **agrupados por módulo** (datos de `GET /permisos`). Bloquear edición/borrado de roles `es_sistema`.
- Actualizar breadcrumb/título a "Usuarios y Roles".

### Tarea 3.6 — Formulario de usuario: select de roles dinámico
En `UserListPage`, el `<Select>` de rol fijo ADMIN/OPERADOR → cargar roles vía `useRoles()` y bindear `rol_id`. Ajustar `useUsers.ts` (`CreateUserInput.rol` → `rol_id`) y `mapUser` (`rol_id`, `rol_nombre`, `es_sistema`).

### Tarea 3.7 — Dashboard por permisos
`Dashboard.tsx`: envolver cada bloque con `useTienePermiso`:
- KPIs ingresos/facturas → `finanzas.facturas`; visitas pendientes → `operaciones.calendario`; impresoras rentadas/stock → `inventario.impresoras`/`inventario.articulos`.
- "Facturas Pendientes"/"Visitas"/"Rentabilidad Top" → sus permisos.
MVP1 (solo inventario) vería solo los KPIs/widgets de inventario. (Opcional: el `DashboardController` ya filtra datos por permiso para evitar filtrar datos no autorizados por la API — añadir como mejora.)

---

## Fase 4 — Validación

1. `docker compose exec app php artisan migrate` (aplica las 3 migraciones + mapeo).
2. `docker compose exec app php artisan test` — añadir tests:
   - Middleware `permission:` deniega (403) y permite; bypass de `es_sistema`.
   - `RoleController` CRUD + que no se pueda borrar rol sistema.
   - Un user con rol "Operador Inventario": 200 en `printers`, `warehouses`, `articles`; 403 en `invoices`, `clients`, `visits`.
3. `docker compose exec app php artisan config:cache` (cambió config/rutas).
4. Rebuild del frontend: `docker compose run --rm --no-deps frontend sh -c "npm run build"` y hard refresh en `http://localhost:8080`.
5. Manual: login `mvp1@redprint.com` / `password`:
   - Solo ve "Inventario" con Impresoras/Artículos/Almacenes (no Mantenimiento, no Movimientos, ni Clientes/Finanzas/Sistema).
   - Entrar por URL a `/finanzas/facturas` → redirige a `/`.
   - `GET /api/v1/invoices` → 403; `GET /api/v1/printers` → 200.
   - Login `admin@redprint.com`: ve todo (bypass), pestaña "Roles" funciona y puede editar permisos del rol.

## Riesgos / Notas

- **Mapeo de usuarios existentes**: depende de que la migración 1.2 siembre los roles antes de la 1.3. Probar en DB con datos reales (no solo `migrate:fresh`).
- **Eliminación de `users.rol`**: actualizar TODOS los lectores (User model, `UserRole` enum, `EnsureUserRole`, `BasePolicy`, `UserResource`, requests, seeder, `api.php`). Si prefiere menor riesgo, dejar `rol` nullable sin usar (deprecado) en vez de dropear.
- **Datos del dashboard vía API**: la UI oculta widgets, pero `/v1/dashboard` podría seguir devolviendo datos de módulos sin permiso. Mitigación recomendada: filtrar en `DashboardController` por permiso (añadir a Fase 2/3 si se quiere blindaje completo).
- **`EnsureUserRole` / `role:ADMIN`**: tras reemplazar por `permission:`, el archivo queda sin uso; mantener por compat o eliminar.
- No usar `npm run dev` en host; flujo es Docker + rebuild del `dist` + recargar 8080.

## Fuera de scope (no se hace en este plan)

- Permisos `.ver`/`.editar` (split lectura/escritura) — pospuesto.
- Auditoría de cambios de permisos (los `audit-log` existentes pueden usarse después).
- Rediseño del dashboard; solo se ocultan/muestran widgets.
- Eliminación de código/features de módulos incompletos (se controla por visibilidad/acceso, no se borra nada).
- Internacionalización; mantener español sin acentos en claves/validaciones como hace el código actual.
