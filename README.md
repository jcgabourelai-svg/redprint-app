# RedPrint

Plataforma web para la **gestión de flotas de impresoras**: control de inventario (impresoras, artículos y almacenes), contratos y clientes, operaciones de campo (visitas y lecturas de contadores), y un módulo financiero completo (facturación, cuentas por cobrar/pagar, compras, conciliación bancaria y reportes).

## Características

- **Dashboard** con métricas e indicadores clave del negocio.
- **Inventario**
  - Impresoras (con historial y vida útil por contador).
  - Artículos y repuestos (compatibilidad con impresoras).
  - Órdenes de mantenimiento (con piezas utilizadas y costos).
  - Almacenes y movimientos de stock (entradas/salidas).
- **Clientes y Contratos** — alta, asignación y liberación de impresoras por contrato.
- **Operaciones** — calendario de visitas, captura de lecturas de contadores.
- **Finanzas**
  - Facturas, pagos y cuentas por cobrar / por pagar.
  - Compras a proveedores y pagos a proveedores.
  - Cuentas bancarias y conciliación.
  - Cierre de periodo y reportes (rentabilidad, rentabilidad por cliente, flujo de caja).
- **Sistema** — gestión de usuarios (RBAC con rol `ADMIN`), centro de notificaciones, bitácora de auditoría y configuración.

## Stack tecnológico

| Capa | Tecnologías |
|------|-------------|
| **Backend** | Laravel 11 · PHP 8.2+ · Sanctum (auth por cookie/token) |
| **Base de datos** | PostgreSQL 16 |
| **Frontend** | React 18 · TypeScript · Vite · TailwindCSS |
| **Estado / Datos** | TanStack Query · Zustand · React Hook Form · Zod |
| **UI** | Framer Motion · Lucide Icons |
| **Testing** | Vitest · Testing Library · PHPUnit |
| **Infraestructura** | Docker Compose · Nginx · PHP-FPM · Caddy (proxy inverso en producción) |

## Arquitectura

```
                   ┌─────────────────────────────────────────────┐
  Producción:      │  Caddy (TLS) ──► Nginx :${APP_PORT}         │
                   └─────────────────────────────────────────────┘
                                          │
                         ┌────────────────┴────────────────┐
                         ▼                                  ▼
                   Frontend (SPA)                    /api/v1, /sanctum
                   (dist estático)                         │
                                                            ▼
                                                    PHP-FPM (Laravel)
                                                            │
                                                            ▼
                                                      PostgreSQL 16
```

- **Nginx** sirve el frontend compilado (`frontend/dist`) como SPA y enruta `/api/`, `/sanctum/` y `/storage/` a PHP-FPM.
- En producción, **Caddy** se coloca por delante terminando TLS y reenvía a `APP_PORT`.
- La API se versiona bajo `/api/v1`.

## Estructura del proyecto

```
redprint-app/
├── backend/                # API Laravel (PHP-FPM)
│   ├── app/                # Models, Controllers, Services
│   ├── database/           # Migraciones, seeders y factories
│   ├── routes/api.php      # Definición de rutas de la API
│   ├── tests/              # Tests PHPUnit
│   └── Dockerfile
├── frontend/               # SPA React + Vite
│   └── src/
│       ├── components/     # Componentes reutilizables
│       ├── pages/          # Páginas por módulo (dashboard, inventory, finance...)
│       ├── lib/            # Cliente API y utilidades
│       ├── store/          # Estado global (Zustand)
│       ├── hooks/ · contexts/ · types/ · stories/
│       └── App.tsx         # Definición de rutas
├── nginx/                  # Plantilla de configuración de Nginx
├── docker-compose.yml      # Orquestación de servicios
├── setup.sh                # Bootstrap del entorno (env, build, migrate, seed)
└── .env.example            # Variables del compose (APP_PORT, DB_*, ...)
```

## Requisitos

- **Docker** y **Docker Compose**
- **Node.js 18+** y **npm** (solo para desarrollo/build del frontend)
- **PHP 8.2+** y **Composer** (solo si se trabaja con el backend fuera de Docker)

## Puesta en marcha

### 1. Entorno completo con Docker (recomendado)

El script `setup.sh` automatiza toda la inicialización:

```bash
cp .env.example .env          # ajusta DB_PASSWORD y APP_DOMAIN para producción
./setup.sh
```

Esto realiza:

1. Copia los archivos `.env` (raíz y backend) si no existen.
2. Verifica que `frontend/dist` esté construido.
3. Levanta los contenedores (`app`, `database`, `nginx`).
4. Instala dependencias de Laravel, genera la `APP_KEY`, ejecuta migraciones, seeders y el symlink de storage.

Una vez completo:

| Servicio | URL |
|----------|-----|
| Frontend | `http://localhost:${APP_PORT}` (por defecto `8080`) |
| API      | `http://localhost:${APP_PORT}/api/v1` |

### 2. Construir el frontend

Antes del primer despliegue (o tras cambios en la UI):

```bash
cd frontend
npm install
npm run build      # genera frontend/dist que sirve Nginx
```

### 3. Desarrollo del frontend con Hot Reload

Para desarrollar el frontend contra el backend en Docker:

```bash
# Backend corriendo en Docker
docker compose up -d

# Frontend en modo desarrollo (puerto 3000 con proxy a la API)
cd frontend
npm run dev
```

Vite expone la app en `http://localhost:3000` y redirige `/api` y `/sanctum` al backend.

## Variables de entorno

### Raíz (`.env` — copiar de `.env.example`)

| Variable | Descripción | Por defecto |
|----------|-------------|-------------|
| `APP_PORT` | Puerto interno donde escucha Nginx | `8080` |
| `APP_DOMAIN` | Dominio público (plantilla de Nginx) | `localhost` |
| `DB_DATABASE` | Nombre de la base de datos | `redprint` |
| `DB_USERNAME` | Usuario de la base de datos | `redprint` |
| `DB_PASSWORD` | Contraseña de la base de datos | `secret` |
| `DB_PORT` | Puerto expuesto de PostgreSQL | `5432` |

> En producción usa contraseñas fuertes y ajusta `APP_DOMAIN`.

### Backend (`backend/.env`)

Incluye configuración de Laravel, conexión PostgreSQL (`pgsql`), Sesiones/Cache/Queue en base de datos y `SANCTUM_STATEFUL_DOMAINS`.

## Scripts

### Frontend (`cd frontend`)

| Comando | Acción |
|---------|--------|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Compilación de producción (`tsc && vite build`) |
| `npm run preview` | Previsualización del build |
| `npm run lint` | ESLint (TypeScript/TSX) |
| `npm test` | Tests con Vitest |
| `npm run test:ui` | Vitest con UI |
| `npm run storybook` | Servidor de Storybook (puerto 6006) |
| `npm run build-storybook` | Build estático de Storybook |

### Backend (dentro del contenedor)

```bash
docker compose exec app php artisan <comando>
```

| Comando | Acción |
|---------|--------|
| `php artisan migrate` | Ejecutar migraciones |
| `php artisan db:seed` | Ejecutar seeders |
| `php artisan key:generate` | Generar APP_KEY |
| `php artisan config:cache` | Refrescar caché de configuración |
| `php artisan test` | Ejecutar tests PHPUnit |
| `composer install` | Instalar dependencias PHP |

## API

La API REST está versionada bajo `/api/v1` y protegida con **Laravel Sanctum** (cookies para SPA). Algunos endpoints relevantes:

- `POST /api/v1/auth/login` · `POST /api/v1/auth/logout` · `GET /api/v1/auth/user`
- Recursos CRUD: `printers`, `clients`, `contracts`, `articles`, `invoices`, `payments`, `purchases`, `maintenance-orders`, `visits`, `readings`, `warehouses`, `bank-accounts`
- Reportes: `/reports/finance/{profitability|client-profitability|cash-flow}`, `/reports/maintenance/...`
- Operaciones: `dashboard`, `notifications`, `audit-log`, `period/{current|history|close}`, `reconciliation/...`

Las rutas de creación de `users`, `suppliers`, `warehouses` y `printers` requieren rol **`ADMIN`**.

## Despliegue en producción

1. Configura `.env` con `APP_DOMAIN` y credenciales seguras.
2. Construye el frontend: `cd frontend && npm ci && npm run build`.
3. Levanta el stack: `docker compose up -d --build`.
4. Ejecuta migraciones: `docker compose exec app php artisan migrate --force`.
5. Optimiza Laravel:
   ```bash
   docker compose exec app php artisan config:cache
   docker compose exec app php artisan route:cache
   docker compose exec app php artisan view:cache
   ```
6. Coloca **Caddy** por delante exponiendo `https://${APP_DOMAIN}` y reenviando a `APP_PORT`.

## Licencia

Propietario. Todos los derechos reservados.
