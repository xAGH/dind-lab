import { config } from '../config.js';
import { createLogger } from '../lib/logger.js';
import { docker, findManagedContainers, STUDENT_LABEL } from './docker.js';
import { deactivate } from './lab.service.js';

const logger = createLogger('idle-reaper');

const CHECK_INTERVAL_MS = 60_000;
// Ciclos sin conexiones establecidas al puerto de ttyd antes de apagar.
const idleCycles = new Map<string, number>();

async function hasActiveConnection(containerId: string): Promise<boolean> {
  try {
    const exec = await docker.getContainer(containerId).exec({
      Cmd: ['sh', '-c', "ss -tn state established '( dport = :7681 or sport = :7681 )' | tail -n +2"],
      AttachStdout: true,
      AttachStderr: false,
    });
    const stream = await exec.start({ hijack: true, stdin: false });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    return Buffer.concat(chunks).toString('utf-8').trim().length > 0;
  } catch {
    // Si no se puede comprobar (ej. ss no disponible), se asume actividad para no apagar de mas.
    return true;
  }
}

async function tick(): Promise<void> {
  const timeoutCycles = config.LAB_IDLE_TIMEOUT_MIN; // 1 ciclo = 1 minuto
  const containers = await findManagedContainers();
  const running = containers.filter((c) => c.State === 'running');
  const runningIds = new Set(running.map((c) => c.Labels[STUDENT_LABEL]));

  // Limpia contadores de instancias que ya no corren.
  for (const id of idleCycles.keys()) {
    if (!runningIds.has(id)) idleCycles.delete(id);
  }

  for (const c of running) {
    const id = c.Labels[STUDENT_LABEL];
    const active = await hasActiveConnection(c.Id);
    if (active) {
      idleCycles.set(id, 0);
      continue;
    }
    const cycles = (idleCycles.get(id) ?? 0) + 1;
    idleCycles.set(id, cycles);
    if (cycles >= timeoutCycles) {
      logger.info('apagando instancia por inactividad', { id, minutosInactivo: cycles });
      await deactivate(id).catch((err) => logger.warn('no se pudo apagar por inactividad', { id, err: err.message }));
      idleCycles.delete(id);
    }
  }
}

export function startIdleReaper(): void {
  if (config.LAB_IDLE_TIMEOUT_MIN <= 0) {
    logger.info('auto-apagado por inactividad desactivado (LAB_IDLE_TIMEOUT_MIN=0)');
    return;
  }
  logger.info('auto-apagado por inactividad activo', { minutos: config.LAB_IDLE_TIMEOUT_MIN });
  setInterval(() => tick().catch((err) => logger.warn('ciclo del idle-reaper fallo', { err: err.message })), CHECK_INTERVAL_MS);
}
