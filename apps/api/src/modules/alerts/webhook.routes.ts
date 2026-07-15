import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { prisma } from '../../lib/prisma';
import { decryptSecret } from '../../lib/crypto';
import { processInboundWebhook } from './webhook.processor';
import { ApiError } from '../../lib/apiError';

export const webhookRouter = Router();

const keyParam = z.object({ key: z.string().min(1).max(64) });

/**
 * Partner integrations POST signed bulletins here instead of (or in addition
 * to) us polling them. Signature: HMAC-SHA256 of the raw request body using
 * the integration's configured apiKey as the secret, sent as `X-Signature`
 * (hex-encoded). Payload shape: see webhook.processor.ts's zod schema.
 *
 * Runs synchronously in serverless context.
 */
webhookRouter.post('/:key', validate({ params: keyParam }), async (req, res, next) => {
  try {
    const credential = await prisma.integrationCredential.findUnique({
      where: { integrationKey: req.params.key },
    });
    if (!credential || !credential.isConfigured) {
      throw new ApiError(404, 'INTEGRATION_NOT_CONFIGURED', 'This integration is not set up');
    }

    const { apiKey } = JSON.parse(decryptSecret(credential.encryptedPayload)) as { apiKey: string };
    const signature = req.header('x-signature');
    if (!signature) throw new ApiError(401, 'MISSING_SIGNATURE', 'X-Signature header required');

    const expected = crypto.createHmac('sha256', apiKey).update(JSON.stringify(req.body)).digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    const valid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    if (!valid) throw new ApiError(401, 'INVALID_SIGNATURE', 'Signature verification failed');

    await processInboundWebhook({
      integrationKey: req.params.key,
      rawPayload: req.body,
      receivedAt: new Date().toISOString(),
    });

    res.status(200).json({ accepted: true });
  } catch (err) {
    next(err);
  }
});
