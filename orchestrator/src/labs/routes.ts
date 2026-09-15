import { Router } from 'express';
import { config } from '../config.js';
import { asyncHandler, badRequest, paramStr } from '../lib/http-error.js';
import { mapLimit } from '../lib/limit.js';
import { rosterStore } from '../roster/store.js';
import { notifyStudentsUpdated } from '../events/sse.js';
import * as labService from './lab.service.js';
import { getStats } from './stats.js';

export const labsRouter = Router();

labsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [students, stats, disk] = await Promise.all([
      labService.listStudents(),
      getStats(),
      labService.getDiskUsage(),
    ]);
    res.json(
      students.map((s) => ({
        ...s,
        stats: stats.get(s.id) ?? null,
        disk: disk.get(s.id) ?? null,
      })),
    );
  }),
);

labsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as { id?: string; prefix?: string; count?: number; group?: string };
    if (body.count && body.count > 0) {
      const created = await rosterStore.addBulk(body.prefix ?? 'alumno', body.count, body.group);
      notifyStudentsUpdated();
      res.status(201).json(created);
      return;
    }
    if (!body.id) throw badRequest('Debes indicar un id o un count para generar en lote.');
    const created = await rosterStore.add(body.id, body.group);
    notifyStudentsUpdated();
    res.status(201).json(created);
  }),
);

labsRouter.post(
  '/:id/activate',
  asyncHandler(async (req, res) => {
    res.json(await labService.activate(paramStr(req.params.id)));
  }),
);

labsRouter.post(
  '/:id/deactivate',
  asyncHandler(async (req, res) => {
    res.json(await labService.deactivate(paramStr(req.params.id)));
  }),
);

labsRouter.post(
  '/:id/regenerate-password',
  asyncHandler(async (req, res) => {
    res.json(await rosterStore.regeneratePassword(paramStr(req.params.id)));
  }),
);

labsRouter.post(
  '/:id/group',
  asyncHandler(async (req, res) => {
    const { group } = req.body as { group?: string };
    if (!group) throw badRequest('Falta el nombre del grupo.');
    res.json(await rosterStore.setGroup(paramStr(req.params.id), group));
  }),
);

labsRouter.get(
  '/:id/logs',
  asyncHandler(async (req, res) => {
    res.type('text/plain').send(await labService.getLogs(paramStr(req.params.id)));
  }),
);

labsRouter.delete(
  '/:id/data',
  asyncHandler(async (req, res) => {
    await labService.wipeVolumes(paramStr(req.params.id));
    res.json({ ok: true });
  }),
);

labsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = paramStr(req.params.id);
    await labService.deactivate(id);
    // El aprendiz sale del roster por completo: a diferencia de un simple apagado,
    // aqui si se liberan sus volumenes (si no, quedan huerfanos en disco).
    await labService.wipeVolumes(id).catch(() => undefined);
    await rosterStore.remove(id);
    notifyStudentsUpdated();
    res.json({ ok: true });
  }),
);

/** Acciones masivas: enciende/apaga varias instancias a la vez con concurrencia limitada. */
labsRouter.post(
  '/bulk/:action',
  asyncHandler(async (req, res) => {
    const action = paramStr(req.params.action);
    if (action !== 'activate' && action !== 'deactivate') {
      throw badRequest('Accion invalida: usa "activate" o "deactivate".');
    }
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) throw badRequest('Debes indicar al menos un id.');

    const fn = action === 'activate' ? labService.activate : labService.deactivate;
    const results = await mapLimit(ids, config.LAB_ACTION_CONCURRENCY, (id) => fn(id));
    notifyStudentsUpdated();

    res.json({
      ok: results.filter((r) => r.ok).map((r) => r.item),
      failed: results
        .filter((r): r is Extract<(typeof results)[number], { ok: false }> => !r.ok)
        .map((r) => ({ id: r.item, message: r.error instanceof Error ? r.error.message : 'error' })),
    });
  }),
);
