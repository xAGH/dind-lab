import type { NextFunction, Request, Response } from 'express';
import { createLogger } from './logger.js';

const logger = createLogger('http');

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function unauthorized(message = 'No autenticado.'): HttpError {
  return new HttpError(401, message);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message);
}

/** Los tipos de Express 5 admiten params como string[]; en esta app siempre son un solo string. */
export function paramStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/** Envuelve un handler async para que sus rechazos lleguen al middleware de errores. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : 'Error inesperado.';
  logger.error('unhandled error', { path: req.path, message });
  res.status(502).json({ message });
}
