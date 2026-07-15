import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { validate } from '../../middleware/validate';
import type { RegionType } from '@prisma/client';

export const regionsRouter = Router();

const querySchema = z.object({
  type: z.enum(['STATE', 'DISTRICT']).optional(),
  search: z.string().max(100).optional(),
});

regionsRouter.get('/', validate({ query: querySchema }), async (req, res, next) => {
  try {
    const { type, search } = req.query as unknown as { type?: RegionType; search?: string };
    const regions = await prisma.region.findMany({
      where: {
        type,
        name: search ? { contains: search, mode: 'insensitive' } : undefined,
      },
      orderBy: { name: 'asc' },
    });
    res.json({ data: regions });
  } catch (err) {
    next(err);
  }
});
