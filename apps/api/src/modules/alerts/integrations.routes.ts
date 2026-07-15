import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { encryptSecret } from '../../lib/crypto';
import { recordAudit } from '../audit/audit.service';
import { Role } from '@prisma/client';

export const integrationsRouter = Router();
integrationsRouter.use(requireAuth, requireRole(Role.ADMIN));

integrationsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.integrationCredential.findMany({
      select: {
        integrationKey: true,
        displayName: true,
        isConfigured: true,
        lastVerifiedAt: true,
        updatedAt: true,
        // encryptedPayload intentionally excluded — never returned via API
      },
    });
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

const keyParam = z.object({ key: z.string().min(1).max(64) });
const credentialBody = z.object({
  displayName: z.string().min(1).max(200),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).max(500),
  headerName: z.string().max(100).optional(),
});

integrationsRouter.put('/:key', validate({ params: keyParam, body: credentialBody }), async (req, res, next) => {
  try {
    const { displayName, ...secretPayload } = req.body;
    const encrypted = encryptSecret(JSON.stringify(secretPayload));

    const row = await prisma.integrationCredential.upsert({
      where: { integrationKey: req.params.key },
      update: { displayName, encryptedPayload: encrypted, isConfigured: true, updatedByUserId: req.user!.sub },
      create: {
        integrationKey: req.params.key,
        displayName,
        encryptedPayload: encrypted,
        isConfigured: true,
        updatedByUserId: req.user!.sub,
      },
    });

    await recordAudit({
      userId: req.user!.sub,
      action: 'integration.credential_updated',
      targetType: 'integration',
      targetId: req.params.key,
    });

    res.json({ data: { integrationKey: row.integrationKey, isConfigured: row.isConfigured } });
  } catch (err) {
    next(err);
  }
});

integrationsRouter.delete('/:key', validate({ params: keyParam }), async (req, res, next) => {
  try {
    await prisma.integrationCredential.update({
      where: { integrationKey: req.params.key },
      data: { isConfigured: false, encryptedPayload: '' },
    });
    await recordAudit({
      userId: req.user!.sub,
      action: 'integration.credential_removed',
      targetType: 'integration',
      targetId: req.params.key,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
