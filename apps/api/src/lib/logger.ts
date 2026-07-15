import pino from 'pino';
import { env, isProd } from '../config/env';

/**
 * Structured JSON logging in production (for ingestion by Loki/ELK/Datadog),
 * pretty-printed in development. Every log line in request-scoped code should
 * come from `req.log` (see middleware/requestContext.ts) so it carries the
 * correlation id automatically.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'northeast-watch-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.tokenHash',
      '*.encryptedPayload',
    ],
    censor: '[REDACTED]',
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});
