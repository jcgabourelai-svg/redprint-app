# RedPrint Operativo (mobile)

App móvil de campo ("prototipo3") que consume **directamente la API real** de
RedPrint (Laravel 11 + Sanctum) sin capa de mapeo: la app habla el contrato
snake_case del backend tal cual.

- Stack: React 18 + Vite + TypeScript + Tailwind CSS (mismo stack que `frontend/`)
- Servida por el nginx del proyecto en **`http://localhost:8080/m/`** (mismo
  origen que la API → cookie/session auth, sin CORS ni cambios de backend)
- UI/UX portada de `redprint/appMovil/prototipo2` (wireframes ya validados)

## Cómo levantar

No hay flujo `npm run dev` en el host: todo corre en Docker (ver `AGENTS.md`
del proyecto). El servicio `mobile` del `docker-compose.yml` compila
`mobile/dist` una sola vez (si no existe) y nginx lo sirve en `/m/`:

```bash
docker compose up -d          # levanta el stack completo (incluida la app móvil)
```

Recompilar tras editar código de la app:

```bash
docker compose run --rm --no-deps mobile sh -c "npm run build"
```

> El build vacía el contenido de `dist` **sin borrar la carpeta** (igual que el
> frontend) para no romper el bind mount de nginx. No cambiar por `rm -rf dist`.

Lint y build de verificación (lo que valida CI):

```bash
docker compose run --rm --no-deps mobile sh -c "npm run lint && npm run build"
```

## Usuario de prueba

| Usuario | Contraseña | Rol | Uso |
|---|---|---|---|
| `operador1@redprint.com` | `password` | operador (todos los permisos) | Flujo completo |
| `mvp1@redprint.com` | `password` | operador-inventario (solo `inventario.*`) | Prueba negativa: sin `operaciones.*` no ve visitas ni capturas |

## Alcance v1

- **Hoy / Calendario**: visitas por mes/año (`GET /visits?month=&year=&per_page=`),
  agrupación client-side (el backend no filtra por día exacto)
- **Detalle de visita** (motivo + actividades): `tipo_visita` es el **motivo
  principal**, no una restricción. La sección *Actividades* ofrece, según
  permisos, todas las acciones en cualquier visita editable:
  - 📊 Tomar lectura (offline-capable vía cola)
  - 📦 Entregar insumos (online-only, permiso `inventario.articulos`)
  - 🔧 Reportar falla → orden `CORRECTIVO` con `visita_id` (online-only,
    permiso `inventario.mantenimiento`; completar la orden queda en el panel
    web y **no** completa la visita)
  - 📥 Instalar impresora → `assign-printer` con `visita_id` (la visita queda
    abierta: el cierre es siempre explícito)
  - 📤 Retirar impresora → `release-printer` con `visita_id` (la visita queda
    abierta: el cierre es siempre explícito)
- **Registrado en la visita** (independiente del motivo): lecturas, insumos
  entregados, órdenes de mantenimiento (`mantenimientos`) y cambios de
  impresora (`cambios_impresoras`)
- **Completar visita** (modal): resumen de actividades; si no hay ninguna, el
  backend exige `motivo_cierre` (textarea obligatoria). `complete` sobre una
  visita ya completada responde 422
- **Acciones de visita**: reprogramar, omitir (marca `OMITIDA`)
- **Captura de lectura**: validación client-side de anomalía
  (`valor_contador < lectura_anterior` exige justificación), foto del contador
  comprimida vía canvas (JPEG ≤1280px q0.7, data-URI en `foto_evidencia`),
  GPS opcional, respuesta con `paginas_consumidas` + `monto_estimado`
- **Registro de campo** (`/registro-campo`, permiso `operaciones.registros-campo`):
  captura de una **visita no catalogada** (cliente o impresora fuera de sistema).
  Tipo (contador / entrega de insumos / otro), nombre del lugar, dirección,
  marca/modelo/serie en texto libre, contador, filas de insumos (texto libre),
  notas, foto de evidencia y GPS opcional. **Offline desde el MVP**: siempre
  pasa por la cola del `SyncManager` (un solo code path online/offline).
  Entradas: CTA "¿El cliente no está en sistema?" en el `EmptyState` de Nueva
  visita cuando la búsqueda no arroja resultados, y botón "📋 Registro" en el
  encabezado de la pantalla de visitas.
- **Notificaciones** y **perfil** (logout, permisos, conteo de la cola: lecturas
  y registros de campo pendientes)

### Comportamientos del backend a tener en cuenta

- **El cierre de una visita es siempre explícito**: ni las lecturas ni la
  instalación/retiro auto-completan la visita. El operador la cierra con el
  botón *Completar visita* (modal con resumen de actividades; si no hay
  ninguna, el backend exige `motivo_cierre`).
- Una instalación/retiro sobre una visita ya completada no falla (solo
  registra el cambio de impresora).
- El `lectura_anterior` del `VisitResource` puede diferir del "previous" que
  usa el backend para validar anomalías (última lectura por impresora+contrato):
  si el backend responde 422 pidiendo justificación, la app revela el campo y
  permite reintentar.
- `GET /visits` es paginado (default 15): la app siempre manda `per_page=100`
  y pagina vía helper `fetchAll`.

## Cola offline (capturas de campo: lecturas y registros)

- IndexedDB `redprint_mobile` → store `sync_queue`; los items se sincronizan
  FIFO secuencialmente al montar la app, al volver la conexión y con el botón
  manual del indicador (⟳). Cada item tiene `type` y el `SyncManager` hace
  dispatch al endpoint correspondiente: `reading → POST /readings`,
  `field_record → POST /field-records`.
- Clasificación de errores: **error de red** → se mantiene y reintenta;
  **4xx del servidor** (p. ej. la 422 de anomalía sin justificación) → se marca
  `error` permanente, visible y descartable/reintentable desde el indicador.
- Dedup de lecturas client-side por `(visita_id, impresora_id)` en tres estados:
  en cola, sincronizada (viene en `visit.readings`) y con error. La captura
  duplicada queda bloqueada con estado visible.
- Dedup de registros de campo **server-side** por `client_uuid` (idempotente):
  un reintento tras timeout ambiguo no duplica la fila (la respuesta 200
  devuelve el registro existente).

### Limitaciones conocidas (aceptadas para el prototipo)

- El backend **no tiene unicidad** por (visita, impresora) en lecturas: un sync
  duplicado crearía una lectura doble. El único guard es el client-side (los
  registros de campo sí tienen dedup server-side por `client_uuid`).
- No hay service worker: sin conexión solo funcionan las capturas (lecturas y
  registros de campo), no la navegación por páginas no visitadas.
- Entregas, reporte de fallas e instalación/retiro requieren conexión
  (operaciones online-only).
- La **regularización de registros de campo es web-only**: vincular el registro
  a cliente/contrato/impresora reales (o descartarlo) se hace desde la bandeja
  web "Operaciones › Registros de campo"; el móvil no crea clientes, contratos
  ni impresoras.
- El reporte de fallas no adjunta foto: `maintenance_orders` no tiene columna
  de evidencia en la API (la descripción del problema es el registro).
- La sesión depende de cookies de Sanctum: para probar desde el teléfono vía
  IP de LAN, arranca el stack con `APP_DOMAIN=<ip>:<puerto>` o la cookie auth
  fallará con 419/401.

## Estructura

```
mobile/
├── index.html              # viewport móvil, theme-color, apple-mobile-web-app
├── vite.config.ts          # base '/m/'
└── src/
    ├── lib/
    │   ├── api.ts          # axios /api/v1 + CSRF + 401 → /m/login (patrón del frontend)
    │   ├── db.ts           # wrapper IndexedDB mínimo (items: reading | field_record)
    │   ├── sync.ts         # gestor de sincronización + cola offline (dispatch por tipo)
    │   ├── photo.ts        # compresión canvas JPEG data-URI
    │   └── format.ts       # fechas/números es-MX
    ├── types/api.ts        # tipos snake_case 1:1 con los Resources del backend
    ├── hooks/              # useAuth (contexto + /auth/user), useOnline, useSyncQueue
    ├── components/         # Layout (nav inferior), SyncIndicator, Toast, ui
    └── pages/              # Login, Hoy, Calendario, VisitDetail, CaptureReading,
                            # Installation, Removal, Delivery, ReportFailure,
                            # NewVisit, NewFieldRecord, Notifications, Profile
```
