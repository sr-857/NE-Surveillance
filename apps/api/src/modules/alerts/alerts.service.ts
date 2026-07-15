import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { recordAudit } from '../audit/audit.service';
import { ApiError } from '../../lib/apiError';
import { alertAdapters } from './adapters';
import type { AdapterStatus, NormalizedAlert } from './adapters/types';
import { AlertSourceType, HazardType, Severity } from '@prisma/client';

export const ALERTS_CHANNEL = 'alerts:new';

/**
 * Polls every registered adapter and idempotently upserts results.
 * Skipped/unconfigured adapters are logged, not silently ignored, so
 * operators can see integration coverage gaps.
 */
export async function pollAllAdapters(): Promise<{ ingested: number; skipped: string[] }> {
  const skipped: string[] = [];
  let ingested = 0;

  for (const adapter of alertAdapters) {
    const configured = await adapter.isConfigured();
    if (!configured) {
      skipped.push(adapter.key);
      continue;
    }
    try {
      const items = await adapter.fetchAlerts();
      for (const item of items) {
        const created = await upsertAlert(item);
        if (created) ingested++;
      }
    } catch (err) {
      logger.error({ err, adapter: adapter.key }, 'adapter poll failed');
    }
  }

  if (skipped.length) {
    logger.info({ skipped }, 'skipped unconfigured hazard adapters this cycle');
  }
  return { ingested, skipped };
}

async function upsertAlert(item: NormalizedAlert): Promise<boolean> {
  const region = await prisma.region.findUnique({ where: { code: item.regionCode } });
  if (!region) {
    logger.warn({ regionCode: item.regionCode, source: item.sourceName }, 'alert references unknown region, dropping');
    return false;
  }

  const existing = await prisma.alert.findUnique({
    where: {
      sourceType_sourceName_externalId: {
        sourceType: item.sourceType,
        sourceName: item.sourceName,
        externalId: item.externalId,
      },
    },
  });

  const alert = await prisma.alert.upsert({
    where: {
      sourceType_sourceName_externalId: {
        sourceType: item.sourceType,
        sourceName: item.sourceName,
        externalId: item.externalId,
      },
    },
    update: {
      severity: item.severity,
      title: item.title,
      description: item.description,
      expiresAt: item.expiresAt,
      isActive: true,
    },
    create: {
      hazardType: item.hazardType,
      severity: item.severity,
      regionCode: item.regionCode,
      title: item.title,
      description: item.description,
      sourceType: item.sourceType,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      externalId: item.externalId,
      effectiveAt: item.effectiveAt,
      expiresAt: item.expiresAt,
    },
  });

  if (!existing) {
    // New alert — the frontend polls /api/alerts every 30s to pick up new entries.
    logger.info({ alertId: alert.id }, 'new alert ingested');
    return true;
  }
  return false;
}

export interface ListAlertsFilter {
  regionCode?: string;
  hazardType?: HazardType;
  severity?: Severity;
  activeOnly?: boolean;
  limit?: number;
}

export async function listAlerts(filter: ListAlertsFilter) {
  return prisma.alert.findMany({
    where: {
      regionCode: filter.regionCode,
      hazardType: filter.hazardType,
      severity: filter.severity,
      isActive: filter.activeOnly ?? true ? true : undefined,
    },
    include: { region: true },
    orderBy: { effectiveAt: 'desc' },
    take: filter.limit ?? 100,
  });
}

export async function createManualAlert(
  input: {
    hazardType: HazardType;
    severity: Severity;
    regionCode: string;
    title: string;
    description: string;
    expiresAt?: Date;
  },
  userId: string,
) {
  const region = await prisma.region.findUnique({ where: { code: input.regionCode } });
  if (!region) throw new ApiError(404, 'REGION_NOT_FOUND', `Unknown region code: ${input.regionCode}`);

  const alert = await prisma.alert.create({
    data: {
      ...input,
      sourceType: AlertSourceType.MANUAL_ENTRY,
      sourceName: 'Northeast Watch Analyst Desk',
      externalId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      effectiveAt: new Date(),
      createdByUserId: userId,
    },
  });

  await recordAudit({ userId, action: 'alert.manual_create', targetType: 'alert', targetId: alert.id });
  logger.info({ alertId: alert.id }, 'manual alert created');
  return alert;
}

export async function acknowledgeAlert(alertId: string, userId: string, note?: string) {
  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert) throw new ApiError(404, 'ALERT_NOT_FOUND', 'Alert does not exist');

  const ack = await prisma.alertAcknowledgement.upsert({
    where: { alertId_userId: { alertId, userId } },
    update: { note },
    create: { alertId, userId, note },
  });
  await recordAudit({ userId, action: 'alert.acknowledge', targetType: 'alert', targetId: alertId });
  return ack;
}

export async function getIntegrationStatuses(): Promise<AdapterStatus[]> {
  const statuses: AdapterStatus[] = [];
  for (const adapter of alertAdapters) {
    statuses.push({
      key: adapter.key,
      displayName: adapter.displayName,
      configured: await adapter.isConfigured(),
    });
  }
  return statuses;
}
