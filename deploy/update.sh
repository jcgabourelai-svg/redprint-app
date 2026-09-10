#!/usr/bin/env bash
# =============================================================================
# Orquestador de actualización de RedPrint (SOLO para el VPS de producción).
#
# Idempotente y seguro para los datos:
#   1. pg_dump de respaldo (siempre, con retención; fuera del árbol de git)
#   2. git fetch + pull --ff-only (aborta si el árbol está sucio o divergió)
#   3. rebuild forzado de frontend y mobile (los builders one-shot se saltan
#      el build si dist/ existe; npm run build vacía el CONTENIDO de dist sin
#      borrar la carpeta -> respeta el bind mount de nginx, decisión D14)
#   4. composer install --no-dev + migrate --force + caches de Laravel
#   5. up -d --build + reinicios explícitos de app/scheduler/nginx
#   6. health check GET contra /sanctum/csrf-cookie (204 esperado; la ruta
#      es GET-only en Sanctum, un POST devolvería 405)
#   7. estado final + version.json dentro del volumen app_storage
#
# La app NUNCA ejecuta shell ni Docker: la comunicación es por archivos en
# storage/app/update/ (volumen nombrado app_storage). Las escrituras desde el
# host usan temp+mv (rename NO sigue symlinks plantados por un posible Laravel
# comprometido, a diferencia de `cat >`), y la bandera nunca se loguea.
# Definiciones compartidas (COMPOSE, APPC, backup_db...) en deploy/common.sh.
#
# Uso:
#   bash deploy/update.sh           # actualización normal (SSH o cron)
#   FORCE=1 bash deploy/update.sh   # fuerza el pipeline completo aunque no
#                                   # haya cambios (p. ej. dist corrupto)
#
# Invocadores válidos: SSH manual, deploy/update-cron.sh (bandera cada 1 min,
# ver DEPLOY.md §4.3) o un futuro GitHub Action. Nunca desde PHP.
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- Configuración (sobreescribible por entorno) ----------------------------
BRANCH="${BRANCH:-main}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
LOG_DIR="${LOG_DIR:-/var/log/redprint}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

source deploy/common.sh

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/update.log"
# Lock en directorio root-only. NUNCA en /tmp (sticky y world-writable:
# permitiría pre-plantar un symlink para que root trunque archivos ajenos,
# o tomar el flock para silenciar todas las actualizaciones).
LOCK_FILE="${LOCK_FILE:-$LOG_DIR/update.lock}"

# --- Helpers -----------------------------------------------------------------
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG_FILE"; }

# Ejecuta en un servicio del stack sin TTY (contexto cron: nunca interactivo).
cexec() { $COMPOSE exec -T "$@"; }

# Escritura symlink-safe dentro del volumen: escribe a un temp y renombra
# (mv reemplaza un symlink plantado; una redirección `>` lo seguiría).
vwrite() { # $1=nombre del archivo dentro de storage/app/update; datos por stdin
    $COMPOSE exec -T app sh -c \
        "cat > '$UPDATE_DIR/.tmp.write' && mv -f '$UPDATE_DIR/.tmp.write' '$UPDATE_DIR/$1'"
}

# Replica el tail del log del host dentro del volumen (lo leerá la API).
sync_log() {
    tail -c 8192 "$LOG_FILE" 2>/dev/null | vwrite update.log 2>/dev/null || true
}

INICIO="$(now)"

write_status() { # $1=estado $2=sha $3=detalle
    printf '{"estado":"%s","rama":"%s","sha":"%s","inicio":"%s","fin":"%s","detalle":"%s"}\n' \
        "$1" "$BRANCH" "${2:-}" "$INICIO" "$(now)" "${3:-}" \
        | vwrite status.json 2>/dev/null || true
}

on_error() {
    log "ERROR: actualización fallida (línea $1, código $2)."
    log "Plan B: restaurar el backup previo de $BACKUP_DIR (DEPLOY.md §5.4)."
    write_status error "${SHA_FINAL:-$(git rev-parse --short HEAD 2>/dev/null || echo '?')}" \
        "fallo en la actualización; ver update.log"
    sync_log
}
trap 'on_error $LINENO $?' ERR
trap 'sync_log' EXIT

# --- Lock: nunca dos actualizaciones simultáneas -----------------------------
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    if [ "${FROM_CRON:-0}" = "1" ]; then
        # El cron ya reclamó (borró) la bandera antes de lanzarnos: sin esto,
        # el pedido se perdería en silencio hasta el próximo click.
        log "Update en curso; re-encolando la bandera para el próximo ciclo."
        $COMPOSE exec -T app sh -c \
            "echo re-encolado > $UPDATE_DIR/request && chown www-data:www-data $UPDATE_DIR/request" \
            2>/dev/null || true
    else
        log "Otra actualización está en ejecución; no hago nada."
    fi
    exit 0
fi

log "========================================================================"
log "Actualización iniciada"

# --- Pre-flight: el VPS jamás debe tener cambios locales ---------------------
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log "ERROR: $REPO_ROOT no es un repositorio git (¿instalación por tarball?)."
    log "Migrar a git siguiendo DEPLOY.md §4.2 y reintentar."
    exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
    log "ERROR: el árbol de git tiene cambios/sobrantes locales."
    log "Política: jamás editar código a mano en el VPS. Corregir y reintentar."
    write_status error "$(git rev-parse --short HEAD)" "árbol de git sucio; requiere atención manual"
    exit 1
fi

# --- Canal de estado dentro del volumen app_storage --------------------------
# Crea el directorio del protocolo y lo deja propiedad de www-data para que
# Laravel (Fase 2) pueda escribir la bandera request.
if ! cexec app sh -c "mkdir -p $UPDATE_DIR && chown -R www-data:www-data $UPDATE_DIR"; then
    log "ERROR: no se pudo preparar $UPDATE_DIR (¿stack caído?)."
    exit 1
fi
printf '' | vwrite update.log || true

# Estado previo ANTES de marcar "corriendo" (decide el short-circuit de abajo).
ESTADO_PREVIO="$(
    cexec app sh -c "cat $UPDATE_DIR/status.json 2>/dev/null" \
        | sed -n 's/.*"estado":"\([^"]*\)".*/\1/p' | head -1
)"
SHA_INICIAL="$(git rev-parse --short HEAD)"
write_status corriendo "$SHA_INICIAL" "actualización en curso"

# --- Paso 1/7: backup de la base (SIEMPRE antes de tocar nada) ---------------
log "Paso 1/7: backup de la base de datos..."
BU_FILE="$(backup_db "$BACKUP_DIR" "$KEEP_BACKUPS")"
log "  backup: $BU_FILE ($(du -h "$BU_FILE" | cut -f1)); retención: $KEEP_BACKUPS"

# --- Paso 2/7: git fetch + pull --ff-only -------------------------------------
log "Paso 2/7: git fetch + pull --ff-only origin/$BRANCH..."
git fetch origin "$BRANCH"
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

# Short-circuit: nada nuevo y el último run terminó bien -> no tocar el stack.
# FORCE=1 lo salta (rebuild de dist, re-ejecutar migraciones/caches, etc.).
if [ "$LOCAL_SHA" = "$REMOTE_SHA" ] && [ "${FORCE:-0}" != "1" ] && [ "$ESTADO_PREVIO" = "listo" ]; then
    log "Sin cambios en origin/$BRANCH y último estado 'listo': nada que hacer."
    write_status listo "$SHA_INICIAL" "sin cambios nuevos"
    exit 0
fi

git pull --ff-only origin "$BRANCH"

# --- Paso 3/7: recompilar frontends (forzado) ---------------------------------
# Nota: esta es la ventana REAL de indisponibilidad (1-3 min): durante el
# rebuild, dist queda semivacío y las cargas NUEVAS de la SPA rompen; la API
# y las sesiones ya cargadas siguen vivas. Aceptado en semiproducción.
log "Paso 3/7: recompilando frontend y móvil (forzado)..."
$COMPOSE run --rm --no-deps -T frontend sh -c 'npm install --no-audit --no-fund && npm run build'
$COMPOSE run --rm --no-deps -T mobile sh -c 'npm install --no-audit --no-fund && npm run build'

# --- Paso 4/7: composer + migraciones + caches --------------------------------
log "Paso 4/7: composer install + migrate --force + caches..."
cexec app composer install --no-dev --no-interaction --optimize-autoloader
cexec app php artisan migrate --force
cexec app php artisan config:cache
cexec app php artisan route:cache
cexec app php artisan view:cache

# --- Paso 5/7: levantar y reiniciar -------------------------------------------
log "Paso 5/7: up -d --build + reinicios explícitos..."
$COMPOSE up -d --build
# up -d solo recrea lo que cambió de config/imagen; el código PHP llega por
# bind mount, así que reiniciamos explícitamente app/scheduler (opcache y
# procesos de larga vida) y nginx (gotcha del inodo de dist; DEPLOY.md §7).
$COMPOSE restart app scheduler nginx

# --- Paso 6/7: health check ----------------------------------------------------
log "Paso 6/7: health check (hasta 2 min)..."
SANO=0
CODE=000
for _ in $(seq 1 24); do
    CODE="$(curl -s -o /dev/null -w '%{http_code}' \
        "http://127.0.0.1:${APP_PORT}/sanctum/csrf-cookie" 2>/dev/null || echo 000)"
    if [ "$CODE" = "204" ] || [ "$CODE" = "200" ]; then SANO=1; break; fi
    sleep 5
done
if [ "$SANO" != "1" ]; then
    log "ERROR: health check falló (último HTTP: $CODE)."
    log "Diagnosticar: $COMPOSE logs --tail=50 app nginx"
    write_status error "$(git rev-parse --short HEAD)" "health check fallido tras actualizar"
    exit 1
fi

# --- Paso 7/7: registrar versión y estado final --------------------------------
log "Paso 7/7: registrando versión y estado final..."
SHA_FINAL="$(git rev-parse --short HEAD)"
printf '{"sha":"%s","rama":"%s","fecha":"%s"}\n' \
    "$(git rev-parse HEAD)" "$BRANCH" "$(now)" \
    | vwrite version.json || true
write_status listo "$SHA_FINAL" "actualización aplicada"
sync_log
log "Actualización completada: $SHA_INICIAL -> $SHA_FINAL."
