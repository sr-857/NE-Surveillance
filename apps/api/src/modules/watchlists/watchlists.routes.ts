import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as watchlistsService from './watchlists.service';
import { RegionType } from '@prisma/client';

export const watchlistsRouter = Router();
watchlistsRouter.use(requireAuth);

watchlistsRouter.get('/', async (req, res, next) => {
  try {
    res.json({ data: await watchlistsService.getWatchlist(req.user!.sub) });
  } catch (err) {
    next(err);
  }
});

const addSchema = z.object({ regionType: z.nativeEnum(RegionType), regionCode: z.string().min(2).max(32) });

watchlistsRouter.post('/items', validate({ body: addSchema }), async (req, res, next) => {
  try {
    const item = await watchlistsService.addToWatchlist(req.user!.sub, req.body.regionType, req.body.regionCode);
    res.status(201).json({ data: item });
  } catch (err) {
    next(err);
  }
});

const itemParam = z.object({ itemId: z.string().uuid() });

watchlistsRouter.delete('/items/:itemId', validate({ params: itemParam }), async (req, res, next) => {
  try {
    await watchlistsService.removeFromWatchlist(req.user!.sub, req.params.itemId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
