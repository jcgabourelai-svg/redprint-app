#!/usr/bin/env bash
# =============================================================================
# Compartido por deploy/update.sh, deploy/update-cron.sh y deploy/backup-cron.sh.
# Se fuentea DESPUÉS de hacer cd al raíz del repo (los tres scripts lo garantizan).
# Single source of truth para: invocación de compose (en el VPS SIEMPRE son dos
# archivos: el override Traefik/Dokploy), acceso barato al contenedor app,
# canal de archivos del orquestador, credenciales del .env y dump+retención.
# =============================================================================

# Operar el stack completo. Si algún día cambia la lista de archivos, debe
# cambiar AQUÍ: duplicarla en cada script garantiza que alguno apunte a un
# stack distinto sin que nadie se entere.
COMPOSE="${COMPOSE:-docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml}"

# Acceso barato al contenedor app para el chequeo por minuto del cron:
# `docker exec` directo evita parsear los dos YAML en cada ciclo. Depende del
# container_name fijado en docker-compose.yml (redprint-app).
APPC="${APPC:-docker exec redprint-app}"

# Canal host<->app: dentro del volumen nombrado app_storage, invisible desde
# el árbol del repo (el contenedor app no ve el .git del repo raíz).
UPDATE_DIR="${UPDATE_DIR:-storage/app/update}"

env_value() { sed -n "s/^${1}=//p" .env 2>/dev/null | tail -1 | tr -d '\r'; }

APP_PORT="$(env_value APP_PORT)";       APP_PORT="${APP_PORT:-8080}"
DB_USERNAME="$(env_value DB_USERNAME)"; DB_USERNAME="${DB_USERNAME:-redprint}"
DB_DATABASE="$(env_value DB_DATABASE)"; DB_DATABASE="${DB_DATABASE:-redprint}"

# Dump comprimido + poda por retención sobre el pool $1/redprint-*.sql.gz.
# Único punto para cambiar formato/retención: update.sh y backup-cron.sh
# comparten el mismo pool y el restore se documenta en DEPLOY.md §5.4.
backup_db() { # $1=directorio destino  $2=cantidad a conservar; imprime la ruta
    local dest="$1" keep="$2" f
    mkdir -p "$dest"
    f="$dest/redprint-$(date +%Y%m%d_%H%M%S).sql.gz"
    $COMPOSE exec -T database pg_dump -U "$DB_USERNAME" "$DB_DATABASE" | gzip > "$f"
    ls -1t "$dest"/redprint-*.sql.gz 2>/dev/null \
        | tail -n +"$((keep + 1))" | xargs -r rm -f
    printf '%s' "$f"
}
