import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { checkRedisHealth } from '../../lib/redis';

export const healthRouter = Router();

/** Liveness: is the process up at all? No dependency checks — used to decide restart-or-not. */
healthRouter.get('/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/** Readiness: can this instance actually serve traffic? Checked by the LB before routing. */
healthRouter.get('/ready', async (_req, res) => {
  const [dbOk, redisOk] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    checkRedisHealth(),
  ]);

  const ready = dbOk && redisOk;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'degraded',
    checks: { database: dbOk, redis: redisOk },
  });
});
