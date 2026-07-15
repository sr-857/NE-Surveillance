import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { ApiError } from '../lib/apiError';

/** Roles are hierarchical: ADMIN > ANALYST > VIEWER. */
const RANK: Record<Role, number> = { ADMIN: 3, ANALYST: 2, VIEWER: 1 };

export function requireRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required'));
    }
    if (RANK[req.user.role] < RANK[minRole]) {
      return next(
        new ApiError(403, 'FORBIDDEN', `Requires ${minRole} role or higher; you have ${req.user.role}`),
      );
    }
    next();
  };
}
