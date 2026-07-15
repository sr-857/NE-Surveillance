import { logger } from './logger';

const cache = new Map<string, { value: any; expiresAt: number }>();

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }

  const value = await loader();

  cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return value;
}

export async function checkRedisHealth(): Promise<boolean> {
  // Always true for serverless memory cache fallback
  return true;
}
