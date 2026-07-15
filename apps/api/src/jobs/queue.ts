import { Queue, Worker, type Job } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const connection = { url: env.REDIS_URL };

export interface WebhookIngestJobData {
  integrationKey: string;
  rawPayload: unknown;
  receivedAt: string;
}

export const webhookIngestQueue = new Queue<WebhookIngestJobData>('webhook-ingest', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/**
 * Processes webhook-delivered hazard bulletins asynchronously. Accepting the
 * webhook and returning 202 immediately (see alerts webhook route), then
 * processing here, means a slow/misbehaving partner integration can't hold
 * an HTTP request — and BullMQ's retry/backoff absorbs transient DB hiccups.
 */
export function startWebhookIngestWorker(
  processFn: (data: WebhookIngestJobData) => Promise<void>,
): Worker<WebhookIngestJobData> {
  const worker = new Worker<WebhookIngestJobData>(
    'webhook-ingest',
    async (job: Job<WebhookIngestJobData>) => {
      await processFn(job.data);
    },
    { connection, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id, attempts: job?.attemptsMade }, 'webhook ingest job failed');
  });
  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'webhook ingest job completed');
  });

  return worker;
}
