import cron, { type ScheduledTask } from 'node-cron';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { getWeatherForAllStates } from '../modules/weather/weather.service';
import { pollAllAdapters } from '../modules/alerts/alerts.service';

/**
 * With multiple API instances behind the load balancer, a naive cron would
 * fire the same job N times per tick — wasteful and, for rate-limited
 * upstreams like partner bulletin APIs, actively harmful. Each tick takes a
 * short Redis lock (SET NX PX) so only one instance actually executes; the
 * others no-op for that tick.
 */
async function withClusterLock(lockKey: string, ttlMs: number, fn: () => Promise<void>): Promise<void> {
  const token = Math.random().toString(36).slice(2);
  const acquired = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
  if (!acquired) return; // another instance already has this tick

  try {
    await fn();
  } catch (err) {
    logger.error({ err, lockKey }, 'scheduled job failed');
  }
}

export function startScheduler(): ScheduledTask[] {
  const tasks: ScheduledTask[] = [];

  // Weather: every 5 minutes
  tasks.push(
    cron.schedule('*/5 * * * *', () =>
      withClusterLock('lock:weather-refresh', 4 * 60 * 1000, async () => {
        const results = await getWeatherForAllStates();
        logger.info({ count: results.length }, '[scheduler] weather refresh complete');
      }),
    ),
  );

  // Disaster alerts (earthquake live + configured integrations): every 1 minute
  tasks.push(
    cron.schedule('* * * * *', () =>
      withClusterLock('lock:alerts-poll', 50 * 1000, async () => {
        const { ingested, skipped } = await pollAllAdapters();
        logger.info({ ingested, skipped }, '[scheduler] alert adapter poll complete');
      }),
    ),
  );

  logger.info({ jobCount: tasks.length }, 'scheduler started');
  return tasks;
}
