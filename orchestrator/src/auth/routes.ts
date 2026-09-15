import { Router } from 'express';
import { config } from '../config.js';
import { asyncHandler, unauthorized } from '../lib/http-error.js';
import {
  SESSION_COOKIE,
  checkLoginRateLimit,
  createSession,
  destroySession,
  readSession,
  verifyPassword,
} from './sessions.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (!checkLoginRateLimit(ip)) {
      throw unauthorized('Demasiados intentos. Espera unos minutos.');
    }

    const { user, password } = req.body as { user?: string; password?: string };
    if (user !== config.ADMIN_USER || !password || !(await verifyPassword(password))) {
      throw unauthorized('Usuario o clave incorrectos.');
    }

    const { token, expiresAt } = createSession(user);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(expiresAt),
    });
    res.json({ ok: true, user });
  }),
);

authRouter.post('/logout', (req, res) => {
  destroySession(req.cookies?.[SESSION_COOKIE] as string | undefined);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

authRouter.get('/session', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const session = readSession(token);
  res.json({ authenticated: Boolean(session), user: session?.user ?? null });
});
