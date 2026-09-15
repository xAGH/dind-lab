import express from 'express';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { createLogger } from './lib/logger.js';
import { asyncHandler, errorHandler } from './lib/http-error.js';
import { authRouter } from './auth/routes.js';
import { requireAuth } from './auth/sessions.js';
import { labsRouter } from './labs/routes.js';
import { studentRouter } from './student/routes.js';
import { sseHandler } from './events/sse.js';
import { startStatsLoop } from './labs/stats.js';
import { startIdleReaper } from './labs/idle-reaper.js';
import { reconcileOnStartup } from './labs/reconcile.js';
import * as labService from './labs/lab.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const logger = createLogger('server');

async function bootstrap(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true); // detras de Traefik: usar X-Forwarded-For para el rate limit por IP

  app.use(cookieParser());
  app.use(express.json());

  // Publica (sin sesion): login del admin y consulta de estado para la landing del aprendiz.
  app.use('/api/auth', authRouter);
  app.use('/', studentRouter);

  // Protegida: todo lo que administra aprendices y contenedores.
  app.use('/api/admin/students', requireAuth, labsRouter);
  app.get('/api/admin/events', requireAuth, sseHandler);
  app.get(
    '/api/admin/summary',
    requireAuth,
    asyncHandler(async (_req, res) => {
      res.json({ activeCount: await labService.countActive(), maxActive: config.LAB_MAX_ACTIVE });
    }),
  );

  app.use('/admin', express.static(path.join(publicDir, 'admin')));
  app.use('/', express.static(path.join(publicDir, 'student')));

  app.use(errorHandler);

  app.listen(config.PORT, () => {
    logger.info(`panel escuchando`, { port: config.PORT });
  });

  startStatsLoop();
  startIdleReaper();
  reconcileOnStartup().catch((err) => logger.error('fallo la reconciliacion inicial', { err: err.message }));
}

bootstrap().catch((err) => {
  logger.error('fallo el arranque', { err: err instanceof Error ? err.message : err });
  process.exit(1);
});
