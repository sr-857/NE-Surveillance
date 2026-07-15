import { z } from 'zod';
import { HazardType, Severity } from '@prisma/client';

export const listAlertsQuerySchema = z.object({
  regionCode: z.string().min(2).max(32).optional(),
  hazardType: z.nativeEnum(HazardType).optional(),
  severity: z.nativeEnum(Severity).optional(),
  activeOnly: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const createAlertSchema = z.object({
  hazardType: z.nativeEnum(HazardType),
  severity: z.nativeEnum(Severity),
  regionCode: z.string().min(2).max(32),
  title: z.string().min(3).max(200),
  description: z.string().min(3).max(2000),
  expiresAt: z.coerce.date().optional(),
});

export const acknowledgeSchema = z.object({
  note: z.string().max(500).optional(),
});

export const alertIdParamSchema = z.object({ id: z.string().uuid() });
