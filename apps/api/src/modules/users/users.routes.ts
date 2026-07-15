import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import * as usersService from './users.service';
import { Role } from '@prisma/client';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole(Role.ADMIN));

usersRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ data: await usersService.listUsers() });
  } catch (err) {
    next(err);
  }
});

const idParam = z.object({ id: z.string().uuid() });
const roleBody = z.object({ role: z.nativeEnum(Role) });
const activeBody = z.object({ isActive: z.boolean() });

usersRouter.patch('/:id/role', validate({ params: idParam, body: roleBody }), async (req, res, next) => {
  try {
    res.json({ data: await usersService.changeUserRole(req.params.id, req.body.role, req.user!.sub) });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/:id/active', validate({ params: idParam, body: activeBody }), async (req, res, next) => {
  try {
    res.json({ data: await usersService.setUserActive(req.params.id, req.body.isActive, req.user!.sub) });
  } catch (err) {
    next(err);
  }
});
