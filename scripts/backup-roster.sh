#!/usr/bin/env bash
# Respaldo del roster (aprendices + claves). Es la unica copia -- correr
# desde un cron diario. Uso: scripts/backup-roster.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${ROSTER_PATH:-data/roster.json}"
BACKUP_DIR="${BACKUP_DIR:-data/backups}"
KEEP="${BACKUP_KEEP:-30}"

if [ ! -f "$SRC" ]; then
  echo "No existe $SRC, nada que respaldar." >&2
  exit 0
fi

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
cp "$SRC" "$BACKUP_DIR/roster-$stamp.json"
chmod 600 "$BACKUP_DIR/roster-$stamp.json"

# Conserva solo los ultimos $KEEP respaldos.
# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/roster-*.json | tail -n "+$((KEEP + 1))" | xargs -r rm --

echo "Respaldo guardado: $BACKUP_DIR/roster-$stamp.json"
