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
    web y **no** auto-completa la visita)
  - 📥 Instalar impresora → `assign-printer` con `visita_id` (auto-completa
    la visita `INSTALACION`)
  - 📤 Retirar impresora → `release-printer` con `visita_id` (auto-completa
    la visita `RETIRO`)
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
- **Notificaciones** y **perfil** (logout, permisos)

### Comportamientos del backend a tener en cuenta

- La visita **se auto-completa** cuando todas las impresoras activas del
  contrato tienen lectura (`ReadingService::checkVisitCompletion`); la app no
  llama a `/visits/{id}/complete` en el flujo de lecturas.
- Instalación/retiro con `visita_id` también auto-completan la visita cuando
  el motivo coincide (`INSTALACION`/`RETIRO`); una segunda operación sobre la
  misma visita ya completada no falla (solo registra el cambio).
- El `lectura_anterior` del `VisitResource` puede diferir del "previous" que
  usa el backend para validar anomalías (última lectura por impresora+contrato):
  si el backend responde 422 pidiendo justificación, la app revela el campo y
  permite reintentar.
- `GET /visits` es paginado (default 15): la app siempre manda `per_page=100`
  y pagina vía helper `fetchAll`.

## Cola offline (solo captura de lecturas)

- IndexedDB `redprint_mobile` → store `sync_queue`; los items se sincronizan
  FIFO secuencialmente al montar la app, al volver la conexión y con el botón
  manual del indicador (⟳).
- Clasificación de errores: **error de red** → se mantiene y reintenta;
  **4xx del servidor** (p. ej. la 422 de anomalía sin justificación) → se marca
  `error` permanente, visible y descartable/reintentable desde el indicador.
- Dedup client-side por `(visita_id, impresora_id)` en tres estados: en cola,
  sincronizada (viene en `visit.readings`) y con error. La captura duplicada
  queda bloqueada con estado visible.

### Limitaciones conocidas (aceptadas para el prototipo)

- El backend **no tiene unicidad** por (visita, impresora): un sync duplicado
  crearía una lectura doble. El único guard es el client-side.
- No hay service worker: sin conexión solo funciona la captura de lecturas
  (no la navegación por páginas no visitadas).
- Entregas, reporte de fallas e instalación/retiro requieren conexión
  (operaciones online-only); la cola offline sigue siendo solo para lecturas.
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
    │   ├── db.ts           # wrapper IndexedDB mínimo (sin dependencias)
    │   ├── sync.ts         # gestor de sincronización + cola offline
    │   ├── photo.ts        # compresión canvas JPEG data-URI
    │   └── format.ts       # fechas/números es-MX
    ├── types/api.ts        # tipos snake_case 1:1 con los Resources del backend
    ├── hooks/              # useAuth (contexto + /auth/user), useOnline, useSyncQueue
    ├── components/         # Layout (nav inferior), SyncIndicator, Toast, ui
    └── pages/              # Login, Hoy, Calendario, VisitDetail, CaptureReading,
                            # Installation, Removal, Delivery, ReportFailure,
                            # NewVisit, Notifications, Profile
```
