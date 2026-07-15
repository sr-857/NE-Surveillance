import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis, redisPub, redisSub } from './lib/redis';
import { attachWebSocketServer } from './websocket/server';
import { startScheduler } from './jobs/scheduler';
import { startWebhookIngestWorker } from './jobs/queue';
import { processInboundWebhook } from './modules/alerts/webhook.processor';

async function main(): Promise<void> {
  const app = createApp();
  const httpServer = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'northeast-watch-api listening');
  });

  const wss = attachWebSocketServer(httpServer);
  const scheduledTasks = startScheduler();
  const worker = startWebhookIngestWorker(processInboundWebhook);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown initiated');

    // Stop accepting new work first.
    scheduledTasks.forEach((t) => t.stop());
    httpServer.close();
    wss.close();

    await Promise.allSettled([
      worker.close(),
      prisma.$disconnect(),
      redis.quit(),
      redisPub.quit(),
      redisSub.quit(),
    ]);

    logger.info('shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception — exiting');
    process.exit(1);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
