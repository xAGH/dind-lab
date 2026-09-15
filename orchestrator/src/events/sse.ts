import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('sse');

/** Bus de eventos compartido: labs.service emite aqui, sse.ts retransmite a los clientes. */
export const labEvents = new EventEmitter();
labEvents.setMaxListeners(100);

export function sseHandler(req: Request, res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onUpdate = (payload: unknown) => send('students-updated', payload);
  labEvents.on('students-updated', onUpdate);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    labEvents.off('students-updated', onUpdate);
    logger.debug('cliente SSE desconectado');
  });
}

export function notifyStudentsUpdated(): void {
  labEvents.emit('students-updated', { at: new Date().toISOString() });
}
