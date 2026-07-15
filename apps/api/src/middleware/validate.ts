import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

interface Schemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validates and REPLACES req.body/query/params with the parsed (and
 * type-coerced/defaulted) result, so downstream handlers can trust the
 * shape completely. Throws ZodError on failure, caught by errorHandler.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query;
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    next();
  };
}
