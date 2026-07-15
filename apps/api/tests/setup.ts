import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://nw_user:nw_password@localhost:5432/northeast_watch_test';
  process.env.REDIS_URL ??= 'redis://localhost:6379/1';
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-characters-long';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-characters-long';
  process.env.CREDENTIAL_ENCRYPTION_KEY ??= 'a'.repeat(64);
  process.env.CORS_ALLOWED_ORIGINS ??= 'http://localhost:5173';
});
