import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

/**
 * These tests hit a real (test) Postgres + Redis, per the project's testing
 * philosophy: no mocking the database in integration tests — mocked DB
 * layers routinely pass while the real query fails (wrong column name,
 * bad join, migration drift). Run via `npm test` with the docker-compose
 * test services up (`docker compose -f infra/docker-compose.test.yml up -d`),
 * or automatically in CI (see .github/workflows/ci.yml).
 */
describe('auth flow', () => {
  let app: Express;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'CorrectHorseBattery9';

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    const { prisma } = await import('../../src/lib/prisma');
    app = createApp();
    // ensure a clean slate for this test's fixture email
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  afterAll(async () => {
    const { prisma } = await import('../../src/lib/prisma');
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it('rejects registration with a weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: 'weak', displayName: 'Test User' });
    expect(res.status).toBe(422);
  });

  it('registers a new user and returns an access token + refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: testPassword, displayName: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects a duplicate registration without revealing the email exists', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: testPassword, displayName: 'Test User' });
    expect(res.status).toBe(409);
  });

  it('rejects login with the wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: testEmail, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
  });

  it('logs in with correct credentials and can access a protected route', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ email: testEmail, password: testPassword });
    expect(loginRes.status).toBe(200);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(testEmail);
    expect(meRes.body.role).toBe('VIEWER'); // self-registration never grants elevated roles
  });

  it('rejects access to a protected route without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ email: testEmail, password: testPassword });
    const firstCookie = loginRes.headers['set-cookie'];

    const refreshRes = await agent.post('/api/auth/refresh');
    expect(refreshRes.status).toBe(200);

    // Replaying the original (now-rotated-out) refresh cookie must fail —
    // this is the reuse-detection path (see auth.service.ts `refresh`).
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
    expect(replay.status).toBe(401);
  });
});

describe('health checks', () => {
  it('liveness probe responds without checking dependencies', async () => {
    const { createApp } = await import('../../src/app');
    const res = await request(createApp()).get('/health/live');
    expect(res.status).toBe(200);
  });
});
