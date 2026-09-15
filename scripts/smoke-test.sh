#!/usr/bin/env bash
# Enciende N instancias de prueba, mide tiempo de arranque y RAM real, y las
# apaga y elimina. Correr antes de la primera clase para calibrar
# LAB_MEM_LIMIT_MB / LAB_MAX_ACTIVE con datos reales.
#
# Uso: ADMIN_PASSWORD=... scripts/smoke-test.sh [cantidad]
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?Define ADMIN_PASSWORD con la clave del panel}"
COUNT="${1:-30}"
PREFIX="smoketest"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

echo "==> Iniciando sesion en $BASE_URL"
curl -sf -c "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d "{\"user\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASSWORD\"}" \
  "$BASE_URL/api/auth/login" > /dev/null

echo "==> Generando $COUNT aprendices de prueba (prefijo $PREFIX)"
curl -sf -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d "{\"prefix\":\"$PREFIX\",\"count\":$COUNT}" \
  "$BASE_URL/api/admin/students" > /dev/null

mapfile -t IDS < <(seq 1 "$COUNT" | sed "s/^/${PREFIX}/")
IDS_JSON=$(printf '%s\n' "${IDS[@]}" | jq -R . | jq -s .)

start_ts=$SECONDS
echo "==> Encendiendo $COUNT instancias..."
curl -sf -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d "{\"ids\":$IDS_JSON}" \
  "$BASE_URL/api/admin/students/bulk/activate" | jq '{ok: (.ok|length), failed: (.failed|length)}'

echo "==> Esperando a que todas queden healthy (maximo 3 minutos)..."
deadline=$((SECONDS + 180))
while [ $SECONDS -lt $deadline ]; do
  active=$(curl -sf -b "$COOKIE_JAR" "$BASE_URL/api/admin/students" \
    | jq "[.[] | select(.id | startswith(\"$PREFIX\")) | select(.status==\"activo\")] | length")
  echo "   activas: $active/$COUNT"
  [ "$active" -ge "$COUNT" ] && break
  sleep 5
done
echo "Tiempo total de arranque: $((SECONDS - start_ts))s"

echo "==> Uso de RAM/CPU de los contenedores del laboratorio:"
mapfile -t NAMES < <(docker ps --filter "label=docker-lab.managed" --format '{{.Names}}')
if [ "${#NAMES[@]}" -gt 0 ]; then
  docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}' "${NAMES[@]}"
fi

echo "==> Apagando y eliminando las instancias de prueba..."
curl -sf -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d "{\"ids\":$IDS_JSON}" \
  "$BASE_URL/api/admin/students/bulk/deactivate" > /dev/null

for id in "${IDS[@]}"; do
  curl -sf -b "$COOKIE_JAR" -X DELETE "$BASE_URL/api/admin/students/$id" > /dev/null
done

echo "Listo. Ajusta LAB_MEM_LIMIT_MB / LAB_MAX_ACTIVE en .env con estos numeros."
