import { Router } from 'express';
import { asyncHandler, notFound, paramStr } from '../lib/http-error.js';
import * as labService from '../labs/lab.service.js';

export const studentRouter = Router();

// Rate limit simple por IP: evita que alguien use esto para enumerar ids validos a lo bruto.
const lookups = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_LOOKUPS = 30;

function allowLookup(ip: string): boolean {
  const now = Date.now();
  const entry = lookups.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    lookups.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_LOOKUPS;
}

/**
 * Estado publico de una instancia para que la landing del aprendiz haga polling
 * y lo redirija sola cuando el instructor la encienda. Nunca expone la clave.
 */
studentRouter.get(
  '/api/lookup/:id',
  asyncHandler(async (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (!allowLookup(ip)) {
      res.status(429).json({ message: 'Demasiadas consultas, espera un momento.' });
      return;
    }

    const id = paramStr(req.params.id).trim().toLowerCase();
    const instance = await labService.getStudentStatus(id);
    if (!instance) throw notFound('No existe un aprendiz con ese id.');

    res.json({ id: instance.id, status: instance.status, url: instance.url });
  }),
);
