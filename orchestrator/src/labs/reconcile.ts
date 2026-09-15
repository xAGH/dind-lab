import { config } from '../config.js';
import { createLogger } from '../lib/logger.js';
import { mapLimit } from '../lib/limit.js';
import { rosterStore } from '../roster/store.js';
import { activate } from './lab.service.js';
import { isRunning } from './docker.js';

const logger = createLogger('reconcile');

/**
 * Al arrancar el orquestador, vuelve a encender lo que estaba activo antes del
 * reinicio -- con concurrencia limitada para no tumbar el host arrancando 30
 * daemons DinD a la vez.
 */
export async function reconcileOnStartup(): Promise<void> {
  const students = await rosterStore.findAll();
  const toActivate = students.filter((s) => s.desiredActive);
  if (toActivate.length === 0) {
    logger.info('nada que reconciliar');
    return;
  }

  logger.info('reconciliando instancias', {
    count: toActivate.length,
    concurrency: config.LAB_RECONCILE_CONCURRENCY,
  });

  const results = await mapLimit(toActivate, config.LAB_RECONCILE_CONCURRENCY, async (s) => {
    if (await isRunning(s.id)) return; // ya estaba corriendo, nada que hacer
    await activate(s.id);
  });

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    logger.error('fallo la reconciliacion de algunas instancias', {
      ids: failed.map((r) => r.item.id),
    });
  }
  logger.info('reconciliacion terminada', {
    ok: results.length - failed.length,
    failed: failed.length,
  });
}
