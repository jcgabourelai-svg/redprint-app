#!/bin/bash
# Bootstrap del entorno RedPrint (Linux / macOS / Git Bash en Windows).
# El contenedor "app" se encarga automaticamente (via entrypoint) de:
#   composer install, key:generate, migrate, db:seed y storage:link.
set -e

echo "=== RedPrint Setup ==="

# 1. .env del compose (raiz): APP_PORT, APP_DOMAIN, DB_*
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Creado .env desde .env.example"
    echo ">> Ajusta DB_PASSWORD y APP_DOMAIN antes de desplegar a produccion <<"
fi

# 2. .env del backend (Laravel)
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "Creado backend/.env desde backend/.env.example"
fi

# 3. Frontend: nginx necesita frontend/dist; si falta, se construye.
if [ ! -f frontend/dist/index.html ]; then
    echo "Construyendo frontend..."
    ( cd frontend && { [ -d node_modules ] || npm ci; } && npm run build )
fi

# 4. Levanta el stack (el entrypoint de "app" hace el resto automaticamente).
APP_PORT=$(grep -E '^APP_PORT=' .env | tail -1 | cut -d= -f2-)
APP_PORT=${APP_PORT:-8080}

echo "Levantando contenedores..."
docker compose up -d --build

echo ""
echo "=== Listo ==="
echo "Frontend: http://localhost:${APP_PORT}"
echo "API:      http://localhost:${APP_PORT}/api/v1"
echo ""
echo "El primer arranque tarda ~30-60s (composer install + migrate + seed)."
echo "En produccion, Caddy expone https://\$APP_DOMAIN y reenvia a este puerto."
