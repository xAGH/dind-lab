#!/bin/sh
set -e

# Sin esto, dockerd-entrypoint.sh genera certificados TLS para exponer el
# daemon por TCP la primera vez que arranca -- no los usamos (ttyd/el aprendiz
# hablan con el socket local), y generarlos retrasa el arranque.
export DOCKER_TLS_CERTDIR=""

# Mirror de registro opcional (lo inyecta el orquestador via REGISTRY_MIRROR si
# esta configurado REGISTRY_MIRROR_URL). Se escribe en cada arranque: no es
# parte del volumen persistente, así que no sobrevive por si sola.
# El mirror va por HTTP plano dentro de la red interna del lab: hay que
# declararlo tambien en insecure-registries o dockerd lo rechaza.
if [ -n "$REGISTRY_MIRROR" ]; then
  mirror_host="$(echo "$REGISTRY_MIRROR" | sed -E 's#^[a-z]+://##')"
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": ["${REGISTRY_MIRROR}"],
  "insecure-registries": ["${mirror_host}"]
}
EOF
fi

# Arranca el daemon Docker propio de este contenedor (aislado del host).
dockerd-entrypoint.sh &

until docker info >/dev/null 2>&1; do
  sleep 1
done

# Carga las imagenes precargadas en el build (make seed) una sola vez: el
# marcador vive en el volumen persistente de datos, asi que sobrevive a que
# se recree el contenedor pero no se repite en cada arranque.
SEED_MARKER=/var/lib/docker/.seed-loaded
if [ -d /seed ] && [ -n "$(ls -A /seed/*.tar 2>/dev/null)" ] && [ ! -f "$SEED_MARKER" ]; then
  echo "Cargando imagenes precargadas..."
  for tarball in /seed/*.tar; do
    docker load -i "$tarball" || echo "aviso: no se pudo cargar $tarball"
  done
  touch "$SEED_MARKER"
fi

# /workspace es el volumen persistente del aprendiz: se usa como HOME para que
# su historial de bash y sus archivos sobrevivan a que se recree el contenedor.
export HOME=/workspace
mkdir -p "$HOME"
cp /etc/skel/.bashrc "$HOME/.bashrc"
cd "$HOME"

BASE_PATH="${BASE_PATH:-}"

if [ -n "$BASE_PATH" ]; then
  exec ttyd -W -p 7681 -t fontSize=16 -t 'titleFixed=Laboratorio Docker' \
    -b "/${BASE_PATH}" -c "${STUDENT}:${PASSWORD}" bash
else
  # Compatibilidad con el modo anterior (un subdominio por alumno, sin base-path).
  exec ttyd -W -p 7681 -t fontSize=16 -c "${STUDENT}:${PASSWORD}" bash
fi
