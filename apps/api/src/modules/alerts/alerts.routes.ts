import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as alertsService from './alerts.service';
import { acknowledgeSchema, alertIdParamSchema, createAlertSchema, listAlertsQuerySchema } from './alerts.schemas';
import { Role } from '@prisma/client';

export const alertsRouter = Router();

alertsRouter.get('/', optionalAuth, validate({ query: listAlertsQuerySchema }), async (req, res, next) => {
  try {
    res.json({ data: await alertsService.listAlerts(req.query as unknown as alertsService.ListAlertsFilter) });
  } catch (err) {
    next(err);
  }
});

alertsRouter.get('/integrations/status', requireAuth, requireRole(Role.ANALYST), async (_req, res, next) => {
  try {
    res.json({ data: await alertsService.getIntegrationStatuses() });
  } catch (err) {
    next(err);
  }
});

alertsRouter.post(
  '/',
  requireAuth,
  requireRole(Role.ANALYST),
  validate({ body: createAlertSchema }),
  async (req, res, next) => {
    try {
      const alert = await alertsService.createManualAlert(req.body, req.user!.sub);
      res.status(201).json({ data: alert });
    } catch (err) {
      next(err);
    }
  },
);

alertsRouter.post(
  '/:id/acknowledge',
  requireAuth,
  requireRole(Role.ANALYST),
  validate({ params: alertIdParamSchema, body: acknowledgeSchema }),
  async (req, res, next) => {
    try {
      const ack = await alertsService.acknowledgeAlert(req.params.id, req.user!.sub, req.body.note);
      res.status(201).json({ data: ack });
    } catch (err) {
      next(err);
    }
  },
);
