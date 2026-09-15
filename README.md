# Laboratorio Docker-in-Docker

Panel web que crea y destruye bajo demanda un contenedor Docker-in-Docker (DinD) con
terminal (ttyd) por cada aprendiz, todos bajo **un solo subdominio**
(`docker-lab.tudominio.com/<id>`), aprovechando Traefik + el *Docker provider* para que
las rutas aparezcan y desaparezcan solas con cada contenedor.

## Como queda armado

```
dind-lab/
├── compose.yml            # orquestador + cache de imagenes (registry mirror)
├── .env.example            # toda la configuracion, copialo a .env
├── Makefile                 # seed, build, up, backup, smoke-test
├── orchestrator/            # API (Express + TypeScript) + panel web estatico
├── lab-image/                # imagen DinD + ttyd que corre cada aprendiz
├── scripts/                  # seed de imagenes, respaldo del roster, smoke test
└── data/                     # roster.json (aprendices + claves) -- NUNCA se sube al repo
```

- **`orchestrator/`** habla con el Docker socket del host para crear/arrancar/detener
  los contenedores de cada aprendiz, sirve el panel del instructor (`/admin`) y la
  landing del aprendiz (`/`).
- **`lab-image/`** es la imagen que corre cada aprendiz: `docker:27-dind` + `ttyd` +
  utilidades (`git`, `compose`, `buildx` ya vienen incluidos), con soporte de imagenes
  precargadas y healthcheck propio.

## 1. Requisitos previos

- Traefik ya corriendo con el *Docker provider* y un `certresolver` configurado (TLS
  real: los labs van por HTTPS, no HTTP plano).
- Una red **dedicada** para el laboratorio, separada de tu red `public` (para que un
  aprendiz no pueda ver el resto de tus servicios):

  ```bash
  docker network create lab-net
  docker network connect lab-net traefik   # el nombre real de tu contenedor de Traefik
  ```

## 2. Configurar

```bash
cp .env.example .env
```

Ajusta al menos `LAB_HOST`, `LAB_CERTRESOLVER` (debe existir ya en tu Traefik) y
`TAILNET_CIDR` (el rango de tu tailnet, para restringir el panel de administracion).

Genera las credenciales del panel:

```bash
cd orchestrator && npm install   # una sola vez, para poder correr el script localmente
npm run hash-password -- "tu-clave-secreta"   # pega el resultado en ADMIN_PASSWORD_HASH
openssl rand -hex 32                          # pega el resultado en SESSION_SECRET
cd ..
```

(Tambien puedes generarlos sin instalar nada local: `make hash-password PASSWORD=...`
usa el contenedor una vez construido.)

## 3. Precargar imagenes del tema de la clase (opcional pero recomendado)

Edita `lab-image/seed-images.txt` con las imagenes que se van a usar (`nginx:alpine`,
`postgres:16-alpine`, etc.) y genera los tarballs:

```bash
make seed
```

Estas imagenes quedan **horneadas en la imagen del laboratorio**: el aprendiz las tiene
desde el primer `docker images`, sin descargar nada. Lo que se salga del guion lo cubre
el *registry mirror* (paso siguiente): se descarga una sola vez para toda la clase en
vez de que cada aprendiz golpee Docker Hub por separado.

## 4. Construir y desplegar

```bash
make build
make up
```

Esto levanta el orquestador y el `registry-mirror`. El panel del instructor queda en
`https://<LAB_HOST>/admin`, protegido por **tres capas**: login propio (usuario/clave),
cookie de sesion, y un `IPAllowList` de Traefik que solo deja pasar tu tailnet. El
orquestador tiene el `docker.sock` montado — eso equivale a acceso root sobre el
servidor, así que nunca debe quedar expuesto a internet.

La landing del aprendiz (`https://<LAB_HOST>/`) es publica: entra con su id, ve el
estado de su instancia y, en cuanto la enciendes desde el panel, la pagina lo redirige
sola a su terminal.

## 5. Calibrar antes de la primera clase

```bash
make smoke-test ADMIN_PASSWORD=tu-clave COUNT=30
```

Enciende `COUNT` instancias de prueba, mide tiempo de arranque y RAM/CPU real con
`docker stats`, y las apaga y elimina. Con esos numeros ajusta `LAB_MEM_LIMIT_MB` y
`LAB_MAX_ACTIVE` en `.env` sobre datos reales de tu servidor, no estimaciones.

## 6. Respaldo del roster

`data/roster.json` es la **unica copia** de los ids y claves de los aprendices. Agrega
un cron diario:

```bash
crontab -e
# 0 3 * * * cd /ruta/a/dind-lab && ./scripts/backup-roster.sh >> /var/log/dind-lab-backup.log 2>&1
```

## Uso del panel

- **+ Agregar aprendiz**: crea un id suelto (ej. `jsuarez`), opcionalmente con grupo.
- **Generar en lote**: crea N ids con un prefijo (`alumno1`...`alumnoN`).
- El switch enciende/apaga la instancia. Al apagar, el contenedor se detiene y se
  elimina, pero **sus datos no**: el workspace y las imagenes que construyo viven en
  volumenes propios (`lab-work-<id>`, `lab-data-<id>`) que sobreviven al apagado. Solo
  se pierden si usas el boton de borrar datos (🗑️) o eliminas al aprendiz por completo.
- Selecciona varios con los checkboxes para **encender/apagar en bloque** (toda la
  clase de una vez, con concurrencia limitada para no saturar el servidor).
- **🖨️ Imprimir** abre una hoja con una tarjeta por aprendiz (id + clave) lista para
  repartir o guardar como PDF. **⬇️ CSV** exporta lo mismo en una hoja de calculo.
- El estado `iniciando…` es real: el link solo aparece cuando el healthcheck de la
  instancia confirma que ttyd ya responde, así que el aprendiz nunca ve un 502.

## Variables de entorno (`.env`)

| Variable | Default | Uso |
|---|---|---|
| `LAB_HOST` | `docker-lab.areasoftccyt.com` | Subdominio unico bajo el que viven todas las rutas |
| `LAB_NETWORK` | `lab-net` | Red Docker de los labs (dedicada, separada de `public`) |
| `LAB_ENTRYPOINT` / `LAB_CERTRESOLVER` | `websecure` / `le` | Entrypoint y resolvedor TLS de Traefik |
| `TAILNET_CIDR` | `100.64.0.0/10` | Rango permitido para el panel de administracion |
| `LAB_IMAGE` | `docker-lab:latest` | Imagen que se usa para cada instancia |
| `LAB_MEM_LIMIT_MB` / `LAB_MEM_RESERVATION_MB` | `1024` / `256` | Techo duro / garantia blanda de RAM por instancia |
| `LAB_CPUS` / `LAB_CPU_SHARES` | `2.0` / `512` | Burst de CPU / reparto proporcional bajo contencion |
| `LAB_PIDS_LIMIT` | `512` | Corta fork bombs sin estorbar a dockerd+containerd |
| `LAB_MAX_ACTIVE` | `30` | Cupo maximo de instancias activas a la vez |
| `LAB_IDLE_TIMEOUT_MIN` | `0` | Auto-apagado tras N minutos sin conexion (0 = desactivado) |
| `LAB_RECONCILE_CONCURRENCY` | `4` | Instancias que se reactivan a la vez si el orquestador reinicia |
| `LAB_ACTION_CONCURRENCY` | `4` | Concurrencia de las acciones masivas del panel |
| `REGISTRY_MIRROR_URL` | `http://registry-mirror:5000` | Cache de Docker Hub compartida por toda la clase |
| `ADMIN_USER` / `ADMIN_PASSWORD_HASH` | `admin` / — | Credenciales del panel (hash bcrypt) |
| `SESSION_SECRET` | — | Obligatorio en produccion (`openssl rand -hex 32`) |
| `PORT` | `3000` | Puerto donde escucha el panel |

## Advertencia de seguridad: contenedores privilegiados

Cada instancia corre con `Privileged: true` (lo exige Docker-in-Docker clasico). Un
aprendiz con esa terminal puede alcanzar `/dev` del host y, en principio, leer su disco.
Es una limitacion inherente a este enfoque, no un descuido puntual. Mitigaciones:

1. **No guardes en este servidor secretos que no puedas rotar.**
2. La red dedicada (`lab-net`, separada de `public`) ya evita que un aprendiz vea el
   resto de tus servicios por la red.
3. A mediano plazo, migrar a `docker:dind-rootless` elimina la necesidad de
   `--privileged` por completo. Cambia el storage driver a `fuse-overlayfs` y conviene
   probarlo con calma fuera de horario de clase antes de activarlo en produccion.

## Desarrollo local

```bash
cd orchestrator
npm install
npm run dev        # tsx watch, recarga en caliente
npm run typecheck
npm run build && npm start   # build de produccion
```

`DOCKER_SOCKET` (default `/var/run/docker.sock`) y `ROSTER_PATH` (default
`/app/data/roster.json`, pensado para el contenedor) se pueden sobreescribir por
variable de entorno para probar en tu maquina antes de desplegar, por ejemplo
`ROSTER_PATH=$(pwd)/../data/roster.json npm run dev`.
