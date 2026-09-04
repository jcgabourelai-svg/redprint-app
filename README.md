# RedPrint

Plataforma web para la **gestión de flotas de impresoras**: control de inventario (impresoras, artículos y almacenes), contratos y clientes, operaciones de campo (visitas y lecturas de contadores), un módulo financiero completo (facturación, CFDI, cuentas por cobrar/pagar, compras, conciliación bancaria y reportes) y una **app móvil de campo** para operadores.

> **Entorno de desarrollo:** todo corre en **Docker** (incluso en local). La app se abre en `http://localhost:8080` servida por Nginx; no hay flujo habitual de `npm run dev` en el host. Detalles del flujo de trabajo en [`AGENTS.md`](AGENTS.md) y en [`mobile/README.md`](mobile/README.md).
>
> **Contexto del negocio y evaluación:** en [`PROJECT.md`](PROJECT.md) está el propósito, alcance, filosofía, flujos de negocio y un marco de evaluación (checklists, preguntas y smells) pensado para que agentes de IA (y humanos) entiendan y juzguen el sistema rápidamente.
>
> **Manual de usuario:** en [`docs/manual-usuario/`](docs/manual-usuario/README.md) está la guía del sistema organizada por rol (administrador, operador de campo, técnico, almacenista y finanzas), con conceptos, flujos paso a paso y preguntas frecuentes.

## Características

- **Dashboard** con métricas e indicadores clave del negocio.
- **Inventario**
  - Impresoras (marcas, modelos, historial y vida útil por contador).
  - Artículos y repuestos (compatibilidad con impresoras, movimientos de stock).
  - Órdenes de mantenimiento (con piezas utilizadas y costos) y gastos por impresora.
  - Almacenes y movimientos de inventario (entradas/salidas).
- **Clientes y Contratos** — alta, asignación y liberación de impresoras por contrato.
- **Operaciones** — calendario de visitas (con generación automática programada), captura de lecturas de contadores.
- **Finanzas**
  - Facturas, pagos y cuentas por cobrar / por pagar.
  - Importación de **CFDI** y vinculación con facturas.
  - Compras a proveedores y pagos a proveedores.
  - Cuentas bancarias y conciliación.
  - Cierre de periodo y reportes (rentabilidad, rentabilidad por cliente, flujo de caja).
- **App móvil de campo** (`/m/`), "RedPrint Operativo" — visitas del día y calendario, captura de lecturas con **cola offline**, entrega de insumos, reporte de fallas, instalación/retiro de impresoras. Ver [`mobile/README.md`](mobile/README.md).
- **Sistema** — gestión de usuarios con **roles y permisos granulares** (RBAC), centro de notificaciones, bitácora de auditoría y configuración.

## Stack tecnológico

| Capa | Tecnologías |
|------|-------------|
| **Backend** | Laravel 11 · PHP 8.2+ · Sanctum (auth por cookie/token) |
| **Base de datos** | PostgreSQL 16 |
| **Frontend** | React 18 · TypeScript · Vite · TailwindCSS |
| **Móvil** | React 18 · TypeScript · Vite · TailwindCSS (SPA servida en `/m/`) |
| **Estado / Datos** | TanStack Query · Zustand · React Hook Form · Zod |
| **UI** | Framer Motion · Lucide Icons · Recharts |
| **Testing** | Vitest · Testing Library · PHPUnit |
| **Infraestructura** | Docker Compose · Nginx · PHP-FPM · Traefik (proxy inverso en producción, VPS con Dokploy) |

## Arquitectura

```
                 ┌──────────────────────────────────────────────┐
  Producción:    │  Traefik/TLS ──► Nginx :${APP_PORT} (127.0.0.1) │
                 └──────────────────────────────────────────────┘
                                        │
                 ┌──────────────────────┼───────────────────┐
                 ▼                      ▼                   ▼
           Frontend (SPA)        App móvil (/m/)      /api/v1, /sanctum
           (dist estático)       (dist estático)             │
                                                            ▼
                                                     PHP-FPM (Laravel)
                                                     │                │
                                                     ▼                ▼
                                                 PostgreSQL    scheduler
                                                               (schedule:work)
```

- **Nginx** sirve el frontend compilado (`frontend/dist`) como SPA en `/`, la app móvil (`mobile/dist`) en `/m/`, y enruta `/api/`, `/sanctum/` y `/storage/` a PHP-FPM.
- En producción, el **Traefik existente en el VPS** (Dokploy) termina TLS y enruta el dominio al nginx del stack vía labels (ver `deploy/docker-compose.prod.yml` y [`deploy/DEPLOY.md`](deploy/DEPLOY.md)).
- La API se versiona bajo `/api/v1`.

### Servicios (docker-compose.yml)

| Servicio | Imagen | Rol |
|----------|--------|-----|
| `frontend` | node:20-alpine | Builder one-shot: compila `frontend/dist` si no existe |
| `mobile` | node:20-alpine | Builder one-shot: compila `mobile/dist` si no existe |
| `app` | build propio | Laravel + PHP-FPM (entrypoint: composer, migrate, seed) |
| `scheduler` | build propio | `php artisan schedule:work` (tareas programadas) |
| `database` | postgres:16-alpine | PostgreSQL 16 |
| `nginx` | nginx:alpine | Sirve `/`, `/m/` y enruta `/api` y `/sanctum` a PHP-FPM |

Puerto público: `${APP_PORT:-8080}`.

### Tareas programadas (scheduler)

- `visits:generate-upcoming` — a diario a las 02:00 (`America/Cancun`), genera las visitas próximas a partir de los contratos activos.

## Estructura del proyecto

```
redprint-app/
├── backend/                # API Laravel (PHP-FPM)
│   ├── app/                # Models, Controllers, Services
│   ├── database/           # Migraciones, seeders y factories
│   ├── routes/api.php      # Definición de rutas de la API
│   ├── tests/              # Tests PHPUnit
│   ├── Dockerfile
│   ├── entrypoint.sh       # Bootstrap automático (dirs, migrate, seed...)
│   └── .dockerignore
├── frontend/               # SPA React + Vite (panel web, servida en /)
│   └── src/
│       ├── components/     # Componentes reutilizables
│       ├── pages/          # Páginas por módulo (dashboard, inventory, finance...)
│       ├── lib/            # Cliente API y utilidades
│       ├── store/          # Estado global (Zustand)
│       ├── hooks/ · contexts/ · types/ · stories/
│       └── App.tsx         # Definición de rutas
├── mobile/                 # App móvil de campo (SPA, servida en /m/)
│   └── src/                # pages/, hooks/, components/, lib/ (api, sync, db...)
├── prototipoMovile/        # Wireframes/prototipos de la app móvil
├── docs/
│   └── manual-usuario/     # Manual de usuario por rol (admin, operador, técnico, almacén, finanzas)
├── nginx/                  # Plantilla de configuración de Nginx
├── docker-compose.yml      # Orquestación de servicios
├── setup.sh                # Bootstrap (Linux/macOS/Git Bash)
├── setup.ps1               # Bootstrap (Windows PowerShell)
├── AGENTS.md               # Contexto de trabajo para agentes de IA
├── PROJECT.md              # Contexto estratégico + marco de evaluación (para IA y humanos)
└── .env.example            # Variables del compose (APP_PORT, DB_*, ...)
```

## Requisitos

- **Docker** y **Docker Compose**
- **Node.js 18+** y **npm** (solo para desarrollo/build manual de los frontales)
- **PHP 8.2+** y **Composer** (solo si se trabaja con el backend fuera de Docker)

## Puesta en marcha

### 1. Entorno completo con Docker (recomendado)

El stack es **totalmente autónomo**: con un solo comando se construyen el frontend y la app móvil dentro de Docker, se crea el `.env`, se generan `APP_KEY`, dependencias, migraciones y seeders. **No necesitas Node, npm, PHP ni Composer instalados en tu máquina**, solo Docker.

```bash
docker compose up -d --build
```

El primer arranque tarda ~1–3 min (build de frontends + composer install + migrate + seed). Una vez completo:

| Servicio | URL |
|----------|-----|
| Frontend | `http://localhost:${APP_PORT}` (por defecto `8080`) |
| App móvil | `http://localhost:${APP_PORT}/m/` |
| API | `http://localhost:${APP_PORT}/api/v1` |

Credenciales sembradas (todas con contraseña `password`): `admin@redprint.com`, `operador1@redprint.com`, `mvp1@redprint.com`, etc.

> El `db:seed` es idempotente: solo se ejecuta si la base está vacía, por lo que reiniciar el stack con `docker compose down && docker compose up -d --build` no duplica datos.

#### ¿Qué pasa automáticamente en el arranque?

- **Servicio `frontend`** (node:20): compila la SPA (`npm install && npm run build`) y deja `frontend/dist` para Nginx. Se omite si el `dist` ya existe.
- **Servicio `mobile`** (node:20): igual, compila `mobile/dist` para servir `/m/`.
- **Contenedor `app`** ejecuta `backend/entrypoint.sh` en cada arranque:
  1. Crea `bootstrap/cache` y `storage/framework/*` con permisos (faltan en un clone fresco por `.gitignore`).
  2. Crea `backend/.env` desde `.env.example` si no existe.
  3. Ajusta `APP_URL`, `FRONTEND_URL` y `SANCTUM_STATEFUL_DOMAINS` al `host:puerto` expuesto (esencial para que el login persista la sesión).
  4. Genera `APP_KEY` si está vacía.
  5. Ejecuta `composer install` si falta `vendor/`.
  6. `php artisan migrate --force` (si `RUN_MIGRATIONS=1`).
  7. `php artisan db:seed --force` **solo si la tabla `users` está vacía**.
  8. `php artisan storage:link` y arranca `php-fpm`.
- **Contenedor `scheduler`**: espera a que `app` esté sano y corre `php artisan schedule:work`.

> ⚠️ **Nota sobre Sanctum y el puerto:** la autenticación SPA por cookies requiere que `SANCTUM_STATEFUL_DOMAINS` incluya el **host con el puerto** del frontend (p. ej. `localhost:8080`). El entrypoint lo garantiza automáticamente; si trabajas el backend fuera de Docker, edítalo a mano en `backend/.env`. Para probar la app móvil desde un teléfono en la LAN, arranca con `APP_DOMAIN=<ip>:<puerto>`.

### 2. Reflejar cambios de frontend/móvil (recompilar el dist)

Los frontales son SPAs compiladas: **editar código no basta**, hay que recompilar el `dist` dentro de Docker y recargar el navegador (`Ctrl+F5`):

```bash
# Panel web
docker compose run --rm --no-deps frontend sh -c "npm run build"

# App móvil
docker compose run --rm --no-deps mobile sh -c "npm run build"
```

> El build **vacía el contenido de `dist` sin borrar la carpeta** para no romper el bind mount de Nginx en Windows/OneDrive. Si aun así aparece un 500 en `/` (pero `/api/...` responde), reinicia el mount con `docker compose restart nginx`.

### 3. Desarrollo del frontend con Hot Reload (opcional)

Para iterar rápido en la UI contra el backend en Docker:

```bash
# Backend corriendo en Docker
docker compose up -d

# Frontend en modo desarrollo (puerto 3000 con proxy a la API)
cd frontend
npm run dev
```

Vite expone la app en `http://localhost:3000` y redirige `/api` y `/sanctum` al backend (ajustable con `VITE_API_PORT`).

## Variables de entorno

### Raíz (`.env` — copiar de `.env.example`)

| Variable | Descripción | Por defecto |
|----------|-------------|-------------|
| `APP_PORT` | Puerto público donde escucha Nginx | `8080` |
| `APP_DOMAIN` | Dominio público (plantilla de Nginx y Sanctum) | `localhost` |
| `DB_DATABASE` | Nombre de la base de datos | `redprint` |
| `DB_USERNAME` | Usuario de la base de datos | `redprint` |
| `DB_PASSWORD` | Contraseña de la base de datos | `secret` |
| `DB_PORT` | Puerto expuesto de PostgreSQL | `5432` |
| `APP_ENV` | `local` (dev, deps de desarrollo) o `production` (`--no-dev`) | `local` |
| `RUN_MIGRATIONS` | `1` = migrar/sembrar al arrancar · `0` = manual (producción) | `1` |

> En producción usa contraseñas fuertes y ajusta `APP_DOMAIN`.

### Backend (`backend/.env`)

Incluye configuración de Laravel, conexión PostgreSQL (`pgsql`), Sesiones/Cache/Queue en base de datos y `SANCTUM_STATEFUL_DOMAINS`.

## Scripts

### Frontend (`cd frontend`)

| Comando | Acción |
|---------|--------|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Compilación de producción (vacia `dist` sin borrarlo y compila) |
| `npm run preview` | Previsualización del build |
| `npm run lint` | ESLint (TypeScript/TSX) |
| `npm test` | Tests con Vitest |
| `npm run test:ui` | Vitest con UI |
| `npm run storybook` | Servidor de Storybook (puerto 6006) |
| `npm run build-storybook` | Build estático de Storybook |

### Móvil (`cd mobile`)

| Comando | Acción |
|---------|--------|
| `npm run build` | Compilación de producción (`tsc --noEmit && vite build`) |
| `npm run lint` | ESLint (TypeScript/TSX) |
| `npm run dev` | Servidor de desarrollo Vite (flujo no habitual; usar Docker) |

### Backend (dentro del contenedor)

```bash
docker compose exec app php artisan <comando>
```

| Comando | Acción |
|--------|--------|
| `php artisan migrate` | Ejecutar migraciones |
| `php artisan db:seed` | Ejecutar seeders |
| `php artisan key:generate` | Generar APP_KEY |
| `php artisan config:cache` | Refrescar caché de configuración |
| `php artisan test` | Ejecutar tests PHPUnit |
| `php artisan visits:generate-upcoming` | Generar visitas próximas (lo corre el scheduler a diario) |
| `composer install` | Instalar dependencias PHP |

## API

La API REST está versionada bajo `/api/v1` y protegida con **Laravel Sanctum** (cookies para SPA). Algunos endpoints relevantes:

- `GET /api/v1/auth/csrf` · `POST /api/v1/auth/login` · `POST /api/v1/auth/logout` · `GET /api/v1/auth/user`
- Recursos CRUD: `printers`, `printer-brands`, `printer-models`, `clients`, `contracts`, `articles`, `warehouses`, `visits`, `readings`, `maintenance-orders`, `users`, `suppliers`
- Inventario: `inventory-movements`, `printer-expenses`, `articles/{id}/movements`
- Finanzas: `invoices`, `payments`, `purchases`, `supplier-payments`, `bank-accounts`, `cfdi` (importación, vinculación y generación de factura)
- Reportes: `/reports/finance/{profitability|client-profitability|cash-flow}`, `/reports/maintenance/...`
- Operaciones: `dashboard`, `notifications`, `audit-log`, `permisos`, `period/{current|history|close}`, `reconciliation/...`, `visits/generate`

### Roles y permisos

- El acceso se controla con **roles** (`ADMIN`, `operador`, `operador-inventario`, ...) y **permisos granulares** (`inventario.*`, `operaciones.*`, ...; ver `GET /api/v1/permisos`).
- Las rutas de creación de `users`, `suppliers`, `warehouses` y `printers` requieren rol **`ADMIN`**.

## Despliegue en producción

La guía completa (despliegue inicial, actualizaciones, backups, dominio y
troubleshooting) está en [`deploy/DEPLOY.md`](deploy/DEPLOY.md). Resumen:

1. Empaquetar solo lo trackeado: `git archive --format=tar.gz -o /tmp/redprint.tar.gz HEAD`.
2. Extraer en `/opt/redprint` del VPS y crear ahí el `.env` de producción
   (`APP_ENV=production`, `PUBLIC_URL=https://...`, contraseña de BD generada
   en el propio VPS; nunca en el repo).
3. Levantar: `docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build`.
4. El TLS lo resuelve el Traefik del VPS (labels en el override de producción).

## Licencia

Propietario. Todos los derechos reservados.
