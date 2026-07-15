import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt';
import { ApiError } from '../lib/apiError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

/** Requires a valid access token. Use `optionalAuth` for public-with-personalization routes. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Missing or malformed Authorization header'));
  }
  const token = header.slice('Bearer '.length);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Invalid or expired access token'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(header.slice('Bearer '.length));
    } catch {
      // ignore — treated as unauthenticated
    }
  }
  next();
}
