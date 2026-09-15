import * as crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { unauthorized } from '../lib/http-error.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('auth');

export const SESSION_COOKIE = 'lab_admin_session';

interface Session {
  user: string;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

function ttlMs(): number {
  return config.SESSION_TTL_HOURS * 60 * 60 * 1000;
}

export function createSession(user: string): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ttlMs();
  sessions.set(token, { user, expiresAt });
  return { token, expiresAt };
}

export function destroySession(token: string | undefined): void {
  if (token) sessions.delete(token);
}

export function readSession(token: string | undefined): Session | undefined {
  if (!token) return undefined;
  const session = sessions.get(token);
  if (!session) return undefined;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return undefined;
  }
  return session;
}

// Limpieza periodica de sesiones vencidas para no acumularlas en memoria indefinidamente.
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(token);
  }
}, 60 * 60 * 1000).unref();

export async function verifyPassword(password: string): Promise<boolean> {
  if (!config.ADMIN_PASSWORD_HASH) return false;
  return bcrypt.compare(password, config.ADMIN_PASSWORD_HASH);
}

// Rate limit simple por IP para el login: max 10 intentos por 5 minutos.
const attempts = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    logger.warn('rate limit de login superado', { ip });
    return false;
  }
  return true;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const session = readSession(token);
  if (!session) {
    next(unauthorized('Sesion invalida o expirada. Vuelve a iniciar sesion.'));
    return;
  }
  next();
}
