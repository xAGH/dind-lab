#!/bin/bash
# El estado "iniciando -> activo" que ve el orquestador depende de este healthcheck:
# no basta con que el contenedor este "running", dockerd y ttyd deben estar listos.
set -e

docker info >/dev/null 2>&1 || exit 1

# Prueba de conexion TCP simple sin depender de que netcat este instalado.
(exec 3<>/dev/tcp/127.0.0.1/7681) 2>/dev/null || exit 1
exec 3>&- 3<&-

exit 0
