import type Docker from 'dockerode';
import { config } from '../config.js';
import { createLogger } from '../lib/logger.js';
import { rosterStore, type Student } from '../roster/store.js';
import {
  MANAGED_LABEL,
  STUDENT_LABEL,
  containerName,
  dataVolumeName,
  workVolumeName,
  docker,
  findContainer,
  findManagedContainers,
} from './docker.js';
import { notifyStudentsUpdated } from '../events/sse.js';

const logger = createLogger('lab');

export type InstanceStatus = 'activo' | 'inactivo' | 'iniciando' | 'deteniendo' | 'error';

export interface StudentInstance extends Student {
  status: InstanceStatus;
  url: string | null;
}

function labUrl(id: string): string {
  return `https://${config.LAB_HOST}/${id}/`;
}

/** Traduce el State/Status crudo de Docker (incluye el healthcheck) a un estado legible. */
function deriveStatus(container: Docker.ContainerInfo | undefined): InstanceStatus {
  if (!container) return 'inactivo';
  const status = container.Status ?? '';

  if (container.State === 'running') {
    if (status.includes('health: starting')) return 'iniciando';
    if (status.includes('unhealthy')) return 'error';
    return 'activo'; // healthy, o sin healthcheck configurado
  }
  if (container.State === 'restarting' || container.State === 'created') return 'iniciando';
  if (container.State === 'removing') return 'deteniendo';
  // Existe pero no corre y no fue un deactivate deliberado (ese elimina el contenedor): se cayo solo.
  return 'error';
}

export async function countActive(): Promise<number> {
  const containers = await findManagedContainers();
  return containers.filter((c) => c.State === 'running').length;
}

export async function listStudents(): Promise<StudentInstance[]> {
  const [students, containers] = await Promise.all([
    rosterStore.findAll(),
    findManagedContainers(),
  ]);

  const byId = new Map(containers.map((c) => [c.Labels[STUDENT_LABEL], c]));

  return students.map((s) => {
    const status = deriveStatus(byId.get(s.id));
    return {
      ...s,
      status,
      url: status === 'activo' ? labUrl(s.id) : null,
    };
  });
}

export async function getStudentStatus(id: string): Promise<StudentInstance | undefined> {
  const student = await rosterStore.findOne(id);
  if (!student) return undefined;
  const container = await findContainer(id);
  const status = deriveStatus(container);
  return { ...student, status, url: status === 'activo' ? labUrl(id) : null };
}

export async function activate(id: string): Promise<StudentInstance> {
  const student = await rosterStore.findOne(id);
  if (!student) throw new Error(`No existe un aprendiz con id "${id}".`);

  const activeCount = await countActive();
  const existing = await findContainer(id);
  const alreadyRunning = existing?.State === 'running';

  if (!alreadyRunning && activeCount >= config.LAB_MAX_ACTIVE) {
    throw new Error(
      `Se alcanzo el cupo maximo de instancias activas (${config.LAB_MAX_ACTIVE}). Apaga alguna antes de encender otra.`,
    );
  }

  if (existing) {
    if (existing.State !== 'running') {
      // Un contenedor detenido y no removido es un residuo (crash); se recrea limpio.
      await docker.getContainer(existing.Id).remove({ v: false, force: true }).catch(() => undefined);
      await createAndStart(student);
    }
  } else {
    await createAndStart(student);
  }

  await rosterStore.setDesiredActive(id, true);
  notifyStudentsUpdated();
  logger.info('instancia activada', { id });
  return { ...student, status: 'iniciando', url: null };
}

export async function deactivate(id: string): Promise<StudentInstance> {
  const student = await rosterStore.findOne(id);
  if (!student) throw new Error(`No existe un aprendiz con id "${id}".`);

  const existing = await findContainer(id);
  if (existing) {
    const container = docker.getContainer(existing.Id);
    if (existing.State === 'running') {
      await container.stop({ t: 10 }).catch(() => undefined);
    }
    // Se elimina el contenedor pero NUNCA los volumenes (v:false): el trabajo
    // y las imagenes del aprendiz sobreviven al apagado.
    await container.remove({ v: false, force: true }).catch(() => undefined);
  }

  await rosterStore.setDesiredActive(id, false);
  notifyStudentsUpdated();
  logger.info('instancia desactivada', { id });
  return { ...student, status: 'inactivo', url: null };
}

/** Uso de disco (bytes) de los volumenes de datos/workspace de cada aprendiz. */
export async function getDiskUsage(): Promise<Map<string, { dataBytes: number; workBytes: number }>> {
  const df = await docker.df();
  const volumes = df.Volumes ?? [];
  const usage = new Map<string, { dataBytes: number; workBytes: number }>();

  for (const v of volumes) {
    const size = v.UsageData?.Size ?? -1;
    if (size < 0) continue;
    if (v.Name.startsWith('lab-data-')) {
      const id = v.Name.slice('lab-data-'.length);
      usage.set(id, { ...(usage.get(id) ?? { dataBytes: 0, workBytes: 0 }), dataBytes: size });
    } else if (v.Name.startsWith('lab-work-')) {
      const id = v.Name.slice('lab-work-'.length);
      usage.set(id, { ...(usage.get(id) ?? { dataBytes: 0, workBytes: 0 }), workBytes: size });
    }
  }
  return usage;
}

export async function getLogs(id: string, tail = 200): Promise<string> {
  const existing = await findContainer(id);
  if (!existing) throw new Error(`La instancia de "${id}" no esta corriendo.`);
  const buffer = await docker.getContainer(existing.Id).logs({
    stdout: true,
    stderr: true,
    tail,
  });
  // dockerode antepone 8 bytes de cabecera multiplexada por linea; los quitamos con una limpieza simple.
  return Buffer.isBuffer(buffer) ? buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, '') : String(buffer);
}

/** Borra tambien los volumenes del aprendiz (datos e imagenes construidas). Irreversible. */
export async function wipeVolumes(id: string): Promise<void> {
  const existing = await findContainer(id);
  if (existing?.State === 'running') {
    throw new Error('Apaga la instancia antes de borrar sus datos.');
  }
  for (const name of [dataVolumeName(id), workVolumeName(id)]) {
    await docker
      .getVolume(name)
      .remove()
      .catch((err: { statusCode?: number }) => {
        if (err.statusCode !== 404) throw err;
      });
  }
  logger.info('volumenes del aprendiz eliminados', { id });
}

async function createAndStart(student: Student): Promise<void> {
  logger.info('creando contenedor', { id: student.id });

  const routerName = containerName(student.id);
  const certResolverLabels: Record<string, string> = config.LAB_CERTRESOLVER
    ? { [`traefik.http.routers.${routerName}.tls.certresolver`]: config.LAB_CERTRESOLVER }
    : {};

  const daemonEnv = config.REGISTRY_MIRROR_URL
    ? [`REGISTRY_MIRROR=${config.REGISTRY_MIRROR_URL}`]
    : [];

  const container = await docker.createContainer({
    name: containerName(student.id),
    Image: config.LAB_IMAGE,
    Env: [
      `STUDENT=${student.id}`,
      `PASSWORD=${student.password}`,
      `BASE_PATH=${student.id}`,
      ...daemonEnv,
    ],
    Labels: {
      [MANAGED_LABEL]: 'true',
      [STUDENT_LABEL]: student.id,
      'traefik.enable': 'true',
      [`traefik.http.routers.${routerName}.rule`]: `Host(\`${config.LAB_HOST}\`) && PathPrefix(\`/${student.id}\`)`,
      [`traefik.http.routers.${routerName}.entrypoints`]: config.LAB_ENTRYPOINT,
      [`traefik.http.services.${routerName}.loadbalancer.server.port`]: '7681',
      ...certResolverLabels,
    },
    HostConfig: {
      Privileged: true,
      RestartPolicy: { Name: 'no' }, // el orquestador reconcilia el estado, no Docker
      Memory: config.labMemLimitBytes,
      MemoryReservation: config.labMemReservationBytes,
      MemorySwap: config.labMemLimitBytes, // sin swap: mejor un OOM local que degradar todo el host
      NanoCpus: config.labNanoCpus,
      CpuShares: config.LAB_CPU_SHARES,
      PidsLimit: config.LAB_PIDS_LIMIT,
      Ulimits: [{ Name: 'nofile', Soft: 8192, Hard: 8192 }],
      NetworkMode: config.LAB_NETWORK,
      Binds: [`${dataVolumeName(student.id)}:/var/lib/docker`, `${workVolumeName(student.id)}:/workspace`],
    },
  });

  await container.start();
}
