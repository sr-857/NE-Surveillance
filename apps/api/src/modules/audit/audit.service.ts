import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

export interface AuditEntry {
  userId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit writes are best-effort relative to the primary action: a failure to
 * write an audit row must never roll back or block the action it's recording
 * (e.g. don't fail a login because the audit insert had a transient error),
 * but it IS logged loudly so an operator notices audit coverage gaps.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({ data: entry });
  } catch (err) {
    logger.error({ err, entry }, 'FAILED to write audit log entry — investigate immediately');
  }
}
