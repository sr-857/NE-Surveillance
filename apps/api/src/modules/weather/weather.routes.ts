import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { optionalAuth } from '../../middleware/auth';
import * as weatherService from './weather.service';

export const weatherRouter = Router();

weatherRouter.get('/', optionalAuth, async (_req, res, next) => {
  try {
    res.json({ data: await weatherService.getWeatherForAllStates() });
  } catch (err) {
    next(err);
  }
});

const regionParams = z.object({ regionCode: z.string().min(2).max(32) });

weatherRouter.get(
  '/:regionCode',
  optionalAuth,
  validate({ params: regionParams }),
  async (req, res, next) => {
    try {
      res.json({ data: await weatherService.getWeatherForRegion(req.params.regionCode) });
    } catch (err) {
      next(err);
    }
  },
);

const trendQuery = z.object({ days: z.coerce.number().int().min(1).max(30).default(7) });

weatherRouter.get(
  '/:regionCode/trend',
  optionalAuth,
  validate({ params: regionParams, query: trendQuery }),
  async (req, res, next) => {
    try {
      const days = (req.query as unknown as { days: number }).days;
      res.json({ data: await weatherService.getWeatherTrend(req.params.regionCode, days) });
    } catch (err) {
      next(err);
    }
  },
);
