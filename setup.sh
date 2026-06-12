#!/bin/bash
set -e

echo "=== RedPrint Setup ==="

if [ ! -f .env ]; then
    cp backend/.env.example backend/.env
    echo "Creado backend/.env desde .env.example"
fi

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
echo "Backend:  http://localhost/api/v1"
echo "Frontend: http://localhost"
echo ""
echo "Para construir el frontend:"
echo "  cd frontend && npm install && npm run build"
