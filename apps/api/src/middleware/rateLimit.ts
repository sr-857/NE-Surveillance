import type { NextFunction, Request, Response } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { redis } from '../lib/redis';
import { env } from '../config/env';
import { ApiError } from '../lib/apiError';
import { logger } from '../lib/logger';

/**
 * Rate limit state lives in Redis so it's shared correctly across every
 * horizontally-scaled API instance behind the load balancer — a per-process
 * in-memory limiter would let a client get N requests per instance instead
 * of N requests total. Falls back to an in-memory limiter (per-instance,
 * best-effort) if Redis is unreachable, so a Redis outage degrades rate
 * limiting rather than taking the API down.
 */
const redisLimiter = new RateLimiterRedis({
  storeClient: redis,
  points: env.RATE_LIMIT_MAX_REQUESTS,
  duration: env.RATE_LIMIT_WINDOW_SECONDS,
  keyPrefix: 'rl',
});

const fallbackLimiter = new RateLimiterMemory({
  points: env.RATE_LIMIT_MAX_REQUESTS,
  duration: env.RATE_LIMIT_WINDOW_SECONDS,
});

export function rateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = req.user?.sub ?? req.ip ?? 'unknown';

  redisLimiter
    .consume(key)
    .then(() => next())
    .catch((rejOrErr) => {
      if (rejOrErr instanceof Error) {
        // Redis itself failed — degrade to in-memory limiter rather than fail open or fail closed.
        logger.warn({ err: rejOrErr }, 'redis rate limiter unavailable, using in-memory fallback');
        fallbackLimiter
          .consume(key)
          .then(() => next())
          .catch(() => next(new ApiError(429, 'RATE_LIMITED', 'Too many requests')));
        return;
      }
      next(new ApiError(429, 'RATE_LIMITED', 'Too many requests, please slow down'));
    });
}

/** Stricter limiter for auth endpoints to slow down credential-stuffing/brute force. */
const authLimiter = new RateLimiterRedis({
  storeClient: redis,
  points: 10,
  duration: 60,
  keyPrefix: 'rl:auth',
});

export function authRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  authLimiter
    .consume(key)
    .then(() => next())
    .catch(() => next(new ApiError(429, 'RATE_LIMITED', 'Too many auth attempts, try again shortly')));
}
