import type { NextFunction, Request, Response } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { env } from '../config/env';
import { ApiError } from '../lib/apiError';
import { logger } from '../lib/logger';

/**
 * In a serverless environment, this runs per-instance (warm start).
 * It provides best-effort rate limiting.
 */
const fallbackLimiter = new RateLimiterMemory({
  points: env.RATE_LIMIT_MAX_REQUESTS,
  duration: env.RATE_LIMIT_WINDOW_SECONDS,
});

export function rateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = req.user?.sub ?? req.ip ?? 'unknown';

  fallbackLimiter
    .consume(key)
    .then(() => next())
    .catch(() => next(new ApiError(429, 'RATE_LIMITED', 'Too many requests')));
}

/** Stricter limiter for auth endpoints to slow down credential-stuffing/brute force. */
const authLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

export function authRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  authLimiter
    .consume(key)
    .then(() => next())
    .catch(() => next(new ApiError(429, 'RATE_LIMITED', 'Too many auth attempts, try again shortly')));
}
