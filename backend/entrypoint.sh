#!/bin/sh
# Entrypoint del contenedor "app" (Laravel / PHP-FPM).
# Se ejecuta en runtime, DESPUES de que los volumenes estan montados, por lo
# que puede crear los directorios que faltan en un clone fresco
# (backend/storage y backend/bootstrap/cache estan en .gitignore y el volumen
# ./backend:/var/www/html los oculta aunque el Dockerfile los cree).
# Es idempotente: seguro para reinicios.
#
# Variables de entorno (definir en .env del compose):
#   APP_ENV         local (dev, con deps de desarrollo) | production (--no-dev).
#   RUN_MIGRATIONS  1 (default, dev) corre migrate+seed; 0 omite (produccion).

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

# APP_KEY: generar solo si esta vacia en .env (idempotente).
if grep -q "^APP_KEY=$" .env 2>/dev/null; then
    echo "[entrypoint] Generando APP_KEY..."
    php artisan key:generate --force
fi

# vendor/: el volumen ./backend oculta el vendor instalado durante el build.
# En produccion excluimos las dependencias de desarrollo (--no-dev).
if [ ! -f vendor/autoload.php ]; then
    if [ "${APP_ENV:-local}" = "local" ]; then
        COMPOSER_DEV_OPT=""
    else
        COMPOSER_DEV_OPT="--no-dev"
    fi
    echo "[entrypoint] Instalando dependencias de composer${COMPOSER_DEV_OPT:+ (sin dev)}..."
    composer install --no-interaction --optimize-autoloader $COMPOSER_DEV_OPT
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
