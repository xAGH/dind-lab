#!/bin/sh
set -e

# Arranca el daemon Docker propio de este contenedor (aislado del host)
dockerd-entrypoint.sh &

# Espera a que el daemon esté listo antes de abrir la terminal
until docker info >/dev/null 2>&1; do
  sleep 1
done

# BASE_PATH llega desde el orquestador (normalmente el mismo id del aprendiz)
# y le dice a ttyd bajo que subruta del subdominio unico va a vivir, para que
# sus assets y el websocket se sirvan correctamente detras de Traefik.
BASE_PATH="${BASE_PATH:-}"

if [ -n "$BASE_PATH" ]; then
  exec ttyd -W -p 7681 -b "/${BASE_PATH}" -c "${STUDENT}:${PASSWORD}" bash
else
  # Compatibilidad con el modo anterior (un subdominio por alumno, sin base-path)
  exec ttyd -W -p 7681 -c "${STUDENT}:${PASSWORD}" bash
fi
