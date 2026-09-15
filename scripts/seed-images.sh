#!/usr/bin/env bash
# Descarga y empaqueta en tarballs las imagenes que se precargan en la imagen
# del laboratorio (ver lab-image/seed-images.txt). Correr antes de `make build`.
set -euo pipefail
cd "$(dirname "$0")/.."

LIST_FILE="${1:-lab-image/seed-images.txt}"
OUT_DIR="lab-image/seed"

if [ ! -f "$LIST_FILE" ]; then
  echo "No existe $LIST_FILE" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
find "$OUT_DIR" -name '*.tar' -delete

count=0
while IFS= read -r raw_line; do
  line="$(echo "$raw_line" | sed 's/#.*//' | xargs || true)"
  [ -z "$line" ] && continue
  image="$line"
  safe_name="$(echo "$image" | tr '/:' '__')"
  echo "==> $image"
  docker pull "$image"
  docker save -o "$OUT_DIR/${safe_name}.tar" "$image"
  count=$((count + 1))
done < "$LIST_FILE"

if [ "$count" -eq 0 ]; then
  echo "Aviso: $LIST_FILE no tiene imagenes listadas, no se genero ningun tarball." >&2
else
  echo "Listo: $count imagenes empaquetadas en $OUT_DIR/"
fi
