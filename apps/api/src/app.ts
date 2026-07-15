import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { env } from './config/env';
import { requestContext } from './middleware/requestContext';
import { rateLimit } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { weatherRouter } from './modules/weather/weather.routes';
import { alertsRouter } from './modules/alerts/alerts.routes';
import { webhookRouter } from './modules/alerts/webhook.routes';
import { integrationsRouter } from './modules/alerts/integrations.routes';
import { usersRouter } from './modules/users/users.routes';
import { watchlistsRouter } from './modules/watchlists/watchlists.routes';
import { regionsRouter } from './modules/regions/regions.routes';

export function createApp(): Express {
  const app = express();

  // Trust the first proxy hop (Nginx/load balancer) so req.ip and req.secure
  // reflect the real client, not the LB — required for correct rate limiting
  // and secure-cookie behavior behind a reverse proxy.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind's runtime injects style tags
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '256kb' })); // small, deliberate cap — this API doesn't accept large payloads
  app.use(cookieParser());
  app.use(requestContext);

  // Health checks are exempt from rate limiting — load balancers poll these frequently.
  app.use('/health', healthRouter);

  app.use(rateLimit);

  app.use('/api/auth', authRouter);
  app.use('/api/weather', weatherRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/webhooks', webhookRouter);
  app.use('/api/admin/integrations', integrationsRouter);
  app.use('/api/admin/users', usersRouter);
  app.use('/api/watchlists', watchlistsRouter);
  app.use('/api/regions', regionsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
