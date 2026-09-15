# Panel del laboratorio Docker-in-Docker

Reemplaza `generate-lab.sh` / `docker-compose.lab.yml` / `teardown.sh` por un panel web
que crea y destruye los contenedores DinD de cada aprendiz bajo demanda, todos bajo
**un solo subdominio** (`docker-lab.areasoftccyt.com/<alumno>`), aprovechando el mismo
Traefik + red `public` que ya usas.

## Cómo queda armado

- `docker-lab-orchestrator/` → este proyecto: API (NestJS) + panel web estático.
  Habla con el Docker socket del host para crear/arrancar/detener contenedores.
- `docker-lab-image/` → tu `Dockerfile` original de la imagen del laboratorio, con el
  `entrypoint.sh` actualizado para soportar `BASE_PATH` (necesario para que ttyd
  funcione bien bajo un path en vez de un subdominio propio).

No necesitas tocar tu Traefik: sigue usando el *Docker provider*, así que en cuanto un
contenedor nace con las labels correctas, la ruta aparece sola; cuando se borra,
desaparece sola. Eso es lo que te da el on/off real.

## 1. Reconstruir la imagen del laboratorio

Copia el `entrypoint.sh` actualizado sobre el que ya tienes (el `Dockerfile` no cambia):

```bash
cp docker-lab-image/entrypoint.sh /ruta/a/tu/proyecto/entrypoint.sh
cd /ruta/a/tu/proyecto
docker build -t docker-lab:latest .
```

## 2. Desplegar el orquestador

```bash
cd docker-lab-orchestrator
mkdir -p data   # aqui se guarda roster.json (aprendices + claves)
```

Genera el hash para el basic auth del panel de administración (usuario `admin`, o el
que prefieras):

```bash
echo $(htpasswd -nB admin) | sed -e s/\$/\$\$/g
```

Pega ese hash en `docker-compose.yml`, reemplazando `REEMPLAZA_ESTE_HASH` en la label
`traefik.http.middlewares.lab-admin-auth.basicauth.users`. Revisa también las
variables de entorno (`LAB_HOST`, `LAB_NETWORK`, límites de memoria/CPU) — ya vienen
con los valores que usabas en `generate-lab.sh`.

```bash
docker compose up -d --build
```

El panel queda accesible en `https://lab-admin.areasoftccyt.com` (protegido con basic
auth vía Traefik). **Recomendado:** ya que tienes Tailscale corriendo en serversena,
vale la pena restringir el acceso a esa ruta solo a tu tailnet en vez de dejarla
pública — el orquestador tiene el docker.sock montado, así que equivale a acceso root
sobre la máquina.

## 3. Usar el panel

- **+ Agregar aprendiz**: crea un id suelto (ej. `jsuarez`).
- **Generar en lote**: crea N ids con un prefijo (`alumno1`...`alumnoN`), igual que
  hacía tu script.
- El switch activa/desactiva la instancia del aprendiz. Al desactivar, el contenedor
  se detiene y se elimina (cada activación arranca con un entorno limpio — si
  prefieres conservar el estado entre clases, se puede cambiar a solo `stop` sin
  `remove`, avísame).
- La columna "Acceso" muestra el link directo (`docker-lab.areasoftccyt.com/<id>/`)
  solo cuando la instancia está activa.
- La clave de cada aprendiz vive en `data/roster.json` — no la muevas de ahí sin
  hacer respaldo, es la única copia.

## Variables de entorno del orquestador

| Variable | Default | Uso |
|---|---|---|
| `LAB_IMAGE` | `docker-lab:latest` | Imagen que se usa para cada instancia |
| `LAB_NETWORK` | `public` | Red Docker donde se conectan las instancias (la misma de Traefik) |
| `LAB_HOST` | `docker-lab.areasoftccyt.com` | Subdominio único bajo el que viven todas las rutas |
| `LAB_MEM_LIMIT_MB` | `1024` | Límite de memoria por instancia |
| `LAB_CPUS` | `1.0` | Límite de CPU por instancia |
| `ROSTER_PATH` | `/app/data/roster.json` | Dónde persiste el listado de aprendices |
| `PORT` | `3000` | Puerto donde escucha el panel |

## Pendiente si quieres seguir mejorándolo

- **Auto-apagado por inactividad**: hoy el apagado es manual desde el panel. Se
  podría agregar un job que revise cuánto lleva sin actividad cada contenedor (o sin
  conexión websocket activa en ttyd) y lo detenga solo tras X minutos.
- **Login centralizado por aprendiz**: hoy cada quien usa su usuario/clave de ttyd
  (más simple). Si más adelante quieres que todos entren por la misma URL sin elegir
  su path a mano, se puede añadir una pantalla de login en el propio panel que
  redirija a `/<id>/` tras validar.
