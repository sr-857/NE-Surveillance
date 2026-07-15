import { createServerlessFunction } from './factory';
import { Router } from 'express';
import { getWeatherForAllStates } from '../src/modules/weather/weather.service';
import { pollAllAdapters } from '../src/modules/alerts/alerts.service';
import { logger } from '../src/lib/logger';
import { env } from '../src/config/env';

const cronRouter = Router();

// Middleware to verify Vercel Cron Secret
cronRouter.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

cronRouter.get('/weather', async (req, res, next) => {
  try {
    const results = await getWeatherForAllStates();
    logger.info({ count: results.length }, '[cron] weather refresh complete');
    res.json({ success: true, count: results.length });
  } catch (err) {
    next(err);
  }
});

cronRouter.get('/alerts', async (req, res, next) => {
  try {
    const { ingested, skipped } = await pollAllAdapters();
    logger.info({ ingested, skipped }, '[cron] alert adapter poll complete');
    res.json({ success: true, ingested, skipped });
  } catch (err) {
    next(err);
  }
});

export default createServerlessFunction('/api/cron', cronRouter);
