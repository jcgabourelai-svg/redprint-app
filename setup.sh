#!/bin/bash
set -e

echo "=== RedPrint Setup ==="

# .env del backend (Laravel)
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "Creado backend/.env desde .env.example"
fi

# .env del compose (raiz): variables APP_PORT, APP_DOMAIN, DB_*
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Creado .env desde .env.example"
    echo ">> Ajusta DB_PASSWORD y APP_DOMAIN antes de desplegar a produccion <<"
fi

# Guard: nginx sirve frontend/dist; si falta, el sitio carga en blanco.
if [ ! -f frontend/dist/index.html ]; then
    echo "ERROR: falta frontend/dist/index.html."
    echo "Construye el frontend primero:  cd frontend && npm ci && npm run build"
    exit 1
fi

# Puerto donde escucha el nginx del proyecto (Caddy va delante en produccion).
APP_PORT=$(grep -E '^APP_PORT=' .env | tail -1 | cut -d= -f2-)
APP_PORT=${APP_PORT:-8080}

echo "Levantando contenedores..."
docker compose up -d --build

echo "Esperando base de datos..."
sleep 5

echo "Instalando dependencias de Laravel..."
docker compose exec app composer install --no-interaction

echo "Generando APP_KEY..."
docker compose exec app php artisan key:generate --force

echo "Ejecutando migraciones..."
docker compose exec app php artisan migrate --force

echo "Ejecutando seeders..."
docker compose exec app php artisan db:seed --force

echo "Creando storage link..."
docker compose exec app php artisan storage:link 2>/dev/null || true

echo ""
echo "=== Setup completo ==="
echo "Frontend: http://localhost:${APP_PORT}"
echo "Backend:  http://localhost:${APP_PORT}/api/v1"
echo ""
echo "En produccion, Caddy expone https://\$APP_DOMAIN y reenvia a este puerto (${APP_PORT})."
