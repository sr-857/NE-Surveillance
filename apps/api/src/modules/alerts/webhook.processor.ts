import { z } from 'zod';
import { HazardType, Severity, AlertSourceType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import type { WebhookIngestJobData } from '../../jobs/queue';
import { redisPub } from '../../lib/redis';
import { ALERTS_CHANNEL } from './alerts.service';

const webhookPayloadSchema = z.object({
  id: z.string().min(1),
  regionCode: z.string().min(2).max(32),
  hazardType: z.nativeEnum(HazardType),
  severity: z.nativeEnum(Severity),
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(2000),
  effectiveAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  bulletinUrl: z.string().url().optional(),
});

/**
 * Runs inside the BullMQ worker (see server.ts), not on the request thread —
 * the webhook route validates the signature and enqueues, then returns 202
 * immediately so a slow DB write never holds a partner's HTTP client open.
 */
export async function processInboundWebhook(job: WebhookIngestJobData): Promise<void> {
  const parsed = webhookPayloadSchema.safeParse(job.rawPayload);
  if (!parsed.success) {
    logger.warn(
      { integrationKey: job.integrationKey, errors: parsed.error.flatten() },
      'rejected malformed webhook payload',
    );
    return; // don't retry — the payload is structurally invalid, retrying won't help
  }
  const item = parsed.data;

  const region = await prisma.region.findUnique({ where: { code: item.regionCode } });
  if (!region) {
    logger.warn({ regionCode: item.regionCode }, 'webhook referenced unknown region, dropping');
    return;
  }

  const credential = await prisma.integrationCredential.findUnique({
    where: { integrationKey: job.integrationKey },
  });

  const alert = await prisma.alert.upsert({
    where: {
      sourceType_sourceName_externalId: {
        sourceType: AlertSourceType.WEBHOOK,
        sourceName: credential?.displayName ?? job.integrationKey,
        externalId: item.id,
      },
    },
    update: {
      severity: item.severity,
      title: item.title,
      description: item.description,
      expiresAt: item.expiresAt ? new Date(item.expiresAt) : undefined,
      isActive: true,
    },
    create: {
      hazardType: item.hazardType,
      severity: item.severity,
      regionCode: item.regionCode,
      title: item.title,
      description: item.description,
      sourceType: AlertSourceType.WEBHOOK,
      sourceName: credential?.displayName ?? job.integrationKey,
      sourceUrl: item.bulletinUrl,
      externalId: item.id,
      effectiveAt: new Date(item.effectiveAt),
      expiresAt: item.expiresAt ? new Date(item.expiresAt) : undefined,
    },
  });

  await redisPub.publish(ALERTS_CHANNEL, JSON.stringify(alert)).catch((err) =>
    logger.warn({ err }, 'failed to publish webhook-sourced alert'),
  );
}
