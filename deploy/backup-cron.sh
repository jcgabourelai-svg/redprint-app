#!/usr/bin/env bash
# =============================================================================
# Backup diario de PostgreSQL para el VPS (cron del host, p. ej. a las 03:00).
#
# Separado de update.sh a propósito: el respaldo diario nunca depende de que
# haya despliegues. update.sh hace SU backup antes de cada actualización;
# este script mantiene el respaldo periódico con retención. Ambos comparten
# el dump+retención de deploy/common.sh (mismo pool, mismo formato).
#
# Protege contra errores de migración/datos, NO contra perder el VPS entero:
# cuando haya datos reales de clientes, sumar copia offsite (idea registrada
# en ideas/despliegue-vps.md §8.5). Los fallos se registran en backup.log
# (trap ERR): un backup roto no puede pasar inadvertido hasta el restore.
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

source deploy/common.sh

BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"
LOG_DIR="${LOG_DIR:-/var/log/redprint}"
mkdir -p "$LOG_DIR"

on_error() {
    printf '[%s] Backup FALLÓ (línea %s, código %s). Diagnosticar: %s ps\n' \
        "$(date '+%F %T')" "$1" "$2" "$COMPOSE" >> "$LOG_DIR/backup.log"
}
trap 'on_error $LINENO $?' ERR

BU="$(backup_db "$BACKUP_DIR" "$KEEP_BACKUPS")"
printf '[%s] Backup OK: %s (%s)\n' \
    "$(date '+%F %T')" "$BU" "$(du -h "$BU" | cut -f1)" >> "$LOG_DIR/backup.log"
