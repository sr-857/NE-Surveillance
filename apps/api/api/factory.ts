import serverless from 'serverless-http';
import express, { Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { env } from '../src/config/env';
import { requestContext } from '../src/middleware/requestContext';
import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler';

export function createServerlessFunction(basePath: string, router: Router) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(requestContext);
  app.use(basePath, router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return serverless(app);
}
