#!/bin/sh
# Entrypoint del contenedor "app" (Laravel / PHP-FPM).
# Se ejecuta en runtime, DESPUES de que los volumenes estan montados, por lo
# que puede crear los directorios y archivos que faltan en un clone fresco
# (backend/storage y backend/bootstrap/cache estan en .gitignore y el volumen
# ./backend:/var/www/html los oculta aunque el Dockerfile los cree).
# Es idempotente: seguro para reinicios.
#
# Variables de entorno (definir en .env del compose):
#   APP_ENV         local (dev, con deps de desarrollo) | production (--no-dev).
#   RUN_MIGRATIONS  1 (default, dev) corre migrate+seed; 0 omite (produccion).
#   APP_PORT        Puerto externo de nginx (para APP_URL / Sanctum stateful).
#   APP_DOMAIN      Dominio/host publico (para APP_URL / Sanctum stateful).

set -e

echo "[entrypoint] Preparando directorios de Laravel..."

mkdir -p \
    bootstrap/cache \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs

chown -R www-data:www-data bootstrap/cache storage
chmod -R 775 bootstrap/cache storage

# ----------------------------------------------------------------------------
# .env del backend: crear desde .env.example si no existe.
# Permite levantar el stack SOLO con "docker compose up" (sin setup script).
# ----------------------------------------------------------------------------
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "[entrypoint] Creado .env desde .env.example"
    else
        echo "[entrypoint] ERROR: no existe .env ni .env.example" >&2
        exit 1
    fi
fi

# Normaliza finales de linea a LF (el .env.example puede venir con CRLF desde
# Windows, lo que rompe los greps y deja APP_KEY vacio -> error 500).
sed -i 's/\r$//' .env

# ----------------------------------------------------------------------------
# APP_URL y SANCTUM_STATEFUL_DOMAINS ajustados al host:puerto expuesto.
# Sanctum solo considera "stateful" (con sesion) las peticiones cuyo
# Referer/Origin coincide con SANCTUM_STATEFUL_DOMAINS. Si el dominio no incluye
# el PUERTO (p.ej. "localhost" pero se sirve en :8080), el login NO persiste la
# sesion y /auth/user devuelve 401. Aqui lo garantizamos automaticamente.
# ----------------------------------------------------------------------------
APP_PORT="${APP_PORT:-8080}"
APP_DOMAIN="${APP_DOMAIN:-localhost}"
APP_HOST_PORT="${APP_DOMAIN}:${APP_PORT}"

# Conjunto canonico de dominios stateful (host con y sin puerto).
SANCTUM_DOMAINS="${APP_DOMAIN},${APP_HOST_PORT},127.0.0.1,127.0.0.1:${APP_PORT}"

# Helper: reescribe una clave de .env borrando todas sus lineas y anadiendo una
# sola al final. Evita los problemas de sed con variables que contienen / : y ,
# (que en una iteracion anterior provoco una linea huerfana y rompio el parser).
set_env() {
    key="$1"
    val="$2"
    if grep -q "^${key}=" .env; then
        sed -i "/^${key}=/d" .env
    fi
    printf '%s=%s\n' "${key}" "${val}" >> .env
}

# PUBLIC_URL (opcional, produccion detras de proxy con HTTPS): URL publica
# real (esquema + dominio, sin puerto interno). Si no se define, se usa el
# comportamiento por defecto http://host:puerto (desarrollo local).
if [ -n "${PUBLIC_URL:-}" ]; then
    set_env APP_URL      "${PUBLIC_URL}"
    set_env FRONTEND_URL "${PUBLIC_URL}"
else
    set_env APP_URL          "http://${APP_HOST_PORT}"
    set_env FRONTEND_URL     "http://${APP_HOST_PORT}"
fi
set_env SANCTUM_STATEFUL_DOMAINS "${SANCTUM_DOMAINS}"

# SESSION_DOMAIN: vacio por defecto (cookie host-only). El .env.example puede
# traer un valor heredado (p. ej. localhost) que romperia la sesion al servir
# la app desde otro dominio. Compose puede fijarlo via variable del mismo nombre.
set_env SESSION_DOMAIN "${SESSION_DOMAIN:-}"

# vendor/: el volumen ./backend oculta el vendor instalado durante el build,
# asi que en un clone fresco NO existe vendor/autoload.php. Hay que instalar
# ANTES de cualquier comando artisan (key:generate, migrate, storage:link...),
# porque artisan requiere el autoloader. En produccion se excluyen las deps
# de desarrollo (--no-dev).
if [ ! -f vendor/autoload.php ]; then
    if [ "${APP_ENV:-local}" = "local" ]; then
        COMPOSER_DEV_OPT=""
    else
        COMPOSER_DEV_OPT="--no-dev"
    fi
    echo "[entrypoint] Instalando dependencias de composer${COMPOSER_DEV_OPT:+ (sin dev)}..."
    composer install --no-interaction --optimize-autoloader $COMPOSER_DEV_OPT
fi

# APP_KEY: generar solo si esta vacia en .env (idempotente).
# El patron tolera espacios/CR residuales por si el .env se edito a mano.
if grep -Eq "^APP_KEY=[[:space:]]*$" .env 2>/dev/null; then
    echo "[entrypoint] Generando APP_KEY..."
    php artisan key:generate --force
fi

# Storage symlink (idempotente, ignora error si ya existe).
php artisan storage:link 2>/dev/null || true

# Migraciones + seed: solo cuando RUN_MIGRATIONS=1 (default, dev).
# En produccion (RUN_MIGRATIONS=0) se controlan manualmente para evitar
# migrar en cada reinicio / multiples replicas.
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
    echo "[entrypoint] Ejecutando migraciones..."
    php artisan migrate --force

    # Seed solo la primera vez (si la tabla users esta vacia).
    USER_COUNT=$(php artisan tinker --execute='echo (string) \App\Models\User::count();' 2>/dev/null | tr -d '[:space:]')
    case "$USER_COUNT" in
        ''|*[!0-9]*)
            echo "[entrypoint] No se pudo verificar el estado de la base; seed omitido por seguridad."
            ;;
        0)
            echo "[entrypoint] Base vacia: ejecutando seeders..."
            php artisan db:seed --force
            ;;
        *)
            echo "[entrypoint] La base ya tiene datos ($USER_COUNT usuarios). Seed omitido."
            ;;
    esac
else
    echo "[entrypoint] RUN_MIGRATIONS!=1: migrate/seed omitidos (modo produccion)."
fi

echo "[entrypoint] Arrancando php-fpm..."

# Permite sobreescribir el comando (p.ej. para 'docker compose exec app sh').
if [ "$1" = "php-fpm" ] || [ -z "$1" ]; then
    exec php-fpm
else
    exec "$@"
fi
