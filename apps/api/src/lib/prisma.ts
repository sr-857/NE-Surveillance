import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { isProd } from '../config/env';

// Prevents exhausting the Postgres connection pool from hot-reloading
// multiple PrismaClient instances in development.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: isProd
      ? [{ emit: 'event', level: 'error' }]
      : [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ],
  });

// @ts-expect-error - Prisma's event typings are awkward to narrow generically here
prisma.$on('error', (e) => logger.error({ err: e }, 'prisma error'));
if (!isProd) {
  // @ts-expect-error - see above
  prisma.$on('query', (e) => logger.debug({ query: e.query, duration: e.duration }, 'prisma query'));
}

if (!isProd) global.__prisma = prisma;
