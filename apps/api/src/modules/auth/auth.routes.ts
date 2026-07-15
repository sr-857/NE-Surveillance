import { Router } from 'express';
import type { Request, Response } from 'express';
import { validate } from '../../middleware/validate';
import { authRateLimit } from '../../middleware/rateLimit';
import { requireAuth } from '../../middleware/auth';
import { loginSchema, registerSchema } from './auth.schemas';
import * as authService from './auth.service';
import { ApiError } from '../../lib/apiError';
import { isProd } from '../../config/env';

export const authRouter = Router();

const REFRESH_COOKIE = 'nw_refresh';
const cookieOpts = {
  httpOnly: true,
  secure: isProd, // requires HTTPS in production (set behind TLS-terminating LB/Nginx)
  sameSite: 'strict' as const,
  path: '/api/auth',
};

function ctxFrom(req: Request) {
  return { ipAddress: req.ip, userAgent: req.header('user-agent') };
}

authRouter.post('/register', authRateLimit, validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const tokens = await authService.register(req.body, ctxFrom(req));
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookieOpts,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', authRateLimit, validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const tokens = await authService.login(req.body, ctxFrom(req));
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookieOpts,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', authRateLimit, async (req: Request, res: Response, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    if (!raw) throw new ApiError(401, 'MISSING_REFRESH_TOKEN', 'No refresh token provided');
    const tokens = await authService.refresh(raw, ctxFrom(req));
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...cookieOpts, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req: Request, res: Response, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) await authService.logout(raw);
    res.clearCookie(REFRESH_COOKIE, cookieOpts);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout-all', requireAuth, async (req: Request, res: Response, next) => {
  try {
    await authService.logoutAllSessions(req.user!.sub);
    res.clearCookie(REFRESH_COOKIE, cookieOpts);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ id: req.user!.sub, email: req.user!.email, role: req.user!.role });
});
