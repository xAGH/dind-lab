import { createLogger } from '../lib/logger.js';
import { docker, findManagedContainers, STUDENT_LABEL } from './docker.js';

const logger = createLogger('stats');

export interface InstanceStats {
  cpuPercent: number;
  memUsedMb: number;
  memLimitMb: number;
  uptimeSeconds: number;
}

let cache = new Map<string, InstanceStats>();
let lastRefresh = 0;
const REFRESH_MS = 10_000;

function cpuPercent(stats: {
  cpu_stats: { cpu_usage: { total_usage: number }; system_cpu_usage?: number; online_cpus?: number };
  precpu_stats: { cpu_usage: { total_usage: number }; system_cpu_usage?: number };
}): number {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = (stats.cpu_stats.system_cpu_usage ?? 0) - (stats.precpu_stats.system_cpu_usage ?? 0);
  const onlineCpus = stats.cpu_stats.online_cpus ?? 1;
  if (systemDelta <= 0 || cpuDelta <= 0) return 0;
  return Math.round((cpuDelta / systemDelta) * onlineCpus * 100 * 10) / 10;
}

async function refresh(): Promise<void> {
  const containers = await findManagedContainers();
  const running = containers.filter((c) => c.State === 'running');

  const next = new Map<string, InstanceStats>();
  await Promise.all(
    running.map(async (c) => {
      const id = c.Labels[STUDENT_LABEL];
      try {
        const raw = await docker.getContainer(c.Id).stats({ stream: false });
        const memUsed = raw.memory_stats.usage ?? 0;
        const memLimit = raw.memory_stats.limit ?? 0;
        const startedAt = new Date(c.Created * 1000).getTime();
        next.set(id, {
          cpuPercent: cpuPercent(raw),
          memUsedMb: Math.round(memUsed / 1024 / 1024),
          memLimitMb: Math.round(memLimit / 1024 / 1024),
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
      } catch (err) {
        logger.warn('no se pudo leer stats', { id, err: (err as Error).message });
      }
    }),
  );
  cache = next;
  lastRefresh = Date.now();
}

export async function getStats(): Promise<Map<string, InstanceStats>> {
  if (Date.now() - lastRefresh > REFRESH_MS) {
    await refresh().catch((err) => logger.warn('refresh de stats fallo', { err: err.message }));
  }
  return cache;
}

export function startStatsLoop(): void {
  refresh().catch(() => undefined);
  setInterval(() => refresh().catch(() => undefined), REFRESH_MS);
}
