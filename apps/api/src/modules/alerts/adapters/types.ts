import type { AlertSourceType, HazardType, Severity } from '@prisma/client';

export interface NormalizedAlert {
  hazardType: HazardType;
  severity: Severity;
  regionCode: string;
  title: string;
  description: string;
  sourceType: AlertSourceType;
  sourceName: string;
  sourceUrl?: string;
  externalId: string; // must be stable across polls for idempotent upsert
  effectiveAt: Date;
  expiresAt?: Date;
}

export interface AdapterStatus {
  key: string;
  displayName: string;
  configured: boolean;
  lastRunAt?: Date;
  lastRunOk?: boolean;
  lastError?: string;
}

/**
 * Every hazard feed — live public API or partner integration — implements
 * this interface. `fetchAlerts` MUST return an empty array (not fabricated
 * data) when the integration isn't configured; callers use `isConfigured()`
 * to distinguish "no active hazards" from "not connected yet" in the UI.
 */
export interface AlertSourceAdapter {
  readonly key: string;
  readonly displayName: string;
  isConfigured(): Promise<boolean>;
  fetchAlerts(): Promise<NormalizedAlert[]>;
}
