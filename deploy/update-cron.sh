#!/usr/bin/env bash
# =============================================================================
# Cron del host (cada 1 min): detecta el archivo bandera storage/app/update/
# request que dejará el endpoint POST /api/v1/system/update (Fase 2, aún no
# implementada) o un operador a mano, y dispara el orquestador update.sh.
#
# Detalles de seguridad/diseño:
# - Chequeo idle con `docker exec redprint-app` (APPC de common.sh): evita
#   parsear los dos YAML de compose 1440 veces al día para un simple test -f.
# - Claim atómico con `mv` a .claimed: el pedido se atiende una sola vez y mv
#   NO sigue symlinks (a diferencia de cat).
# - El CONTENIDO de la bandera jamás se loguea: el directorio es escribible
#   por www-data y un symlink plantado (p. ej. a /proc/1/environ, que contiene
#   DB_PASSWORD) exfiliaría secretos a cron.log. El solicitante lo auditará
#   Laravel en su propio log cuando exista la Fase 2.
#
# También sirve para probar el flujo completo a mano (Fase 1):
#   docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml \
#     exec -T app sh -c 'echo manual > storage/app/update/request'
# y esperar <60 s a este cron (o ejecutarlo directamente).
# =============================================================================

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

source deploy/common.sh

LOG_DIR="${LOG_DIR:-/var/log/redprint}"
mkdir -p "$LOG_DIR"

FLAG="$UPDATE_DIR/request"

# Sin contenedor app corriendo no hay bandera que atender (y el endpoint que
# la escribe tampoco funcionaría): salir en silencio.
if ! $APPC test -f "$FLAG" 2>/dev/null; then
    exit 0
fi

# Claim atómico: mv falla si la bandera ya no existe (atendida en otro ciclo).
if ! $APPC mv "$FLAG" "$UPDATE_DIR/.claimed" 2>/dev/null; then
    exit 0
fi
$APPC rm -f "$UPDATE_DIR/.claimed" 2>/dev/null || true

printf '[%s] Bandera de actualización detectada. Lanzando update.sh...\n' \
    "$(date '+%F %T')" >> "$LOG_DIR/cron.log"

# FROM_CRON=1: si update.sh encuentra el lock ocupado (update en curso),
# re-encola la bandera en vez de descartar el pedido en silencio.
FROM_CRON=1 exec bash "$REPO_ROOT/deploy/update.sh"
