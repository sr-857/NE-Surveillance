import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/apiError';
import { isProd } from '../config/env';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const body: ErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        requestId: req.id,
        details: err.flatten(),
      },
    };
    req.log.warn({ err: err.flatten() }, 'validation error');
    res.status(422).json(body);
    return;
  }

  if (err instanceof ApiError) {
    const body: ErrorBody = {
      error: { code: err.code, message: err.message, requestId: req.id, details: err.details },
    };
    const level = err.statusCode >= 500 ? 'error' : 'warn';
    req.log[level]({ err }, 'api error');
    res.status(err.statusCode).json(body);
    return;
  }

  // Unexpected error — log full detail server-side, return a generic message to the client.
  req.log.error({ err }, 'unhandled error');
  const body: ErrorBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'An unexpected error occurred' : String((err as Error)?.message ?? err),
      requestId: req.id,
      ...(isProd ? {} : { details: (err as Error)?.stack }),
    },
  };
  res.status(500).json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}`, requestId: req.id },
  });
}
