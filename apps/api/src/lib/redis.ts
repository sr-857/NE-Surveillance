import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Two connections by design: ioredis pub/sub connections can't issue normal
 * commands once subscribed, so the websocket layer needs a dedicated one.
 * Both share the same Redis instance/cluster in deployment.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableAutoPipelining: true,
});

export const redisSub = new Redis(env.REDIS_URL);
export const redisPub = new Redis(env.REDIS_URL);

redis.on('error', (err) => logger.error({ err }, 'redis connection error'));
redisSub.on('error', (err) => logger.error({ err }, 'redis (sub) connection error'));
redisPub.on('error', (err) => logger.error({ err }, 'redis (pub) connection error'));

/**
 * Thin cache-aside helper used by the weather/alerts modules. Falls back to
 * calling `loader` on cache miss AND on any Redis error — Redis being down
 * degrades performance, it must never take the API down.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn({ err, key }, 'redis cache read failed, falling through to loader');
  }

  const value = await loader();

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, 'redis cache write failed, continuing without cache');
  }

  return value;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
