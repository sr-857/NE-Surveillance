import type { AlertSourceType, HazardType, Severity } from '@prisma/client';
import type { AlertSourceAdapter, NormalizedAlert } from './types';
import { prisma } from '../../../lib/prisma';
import { decryptSecret } from '../../../lib/crypto';
import { logger } from '../../../lib/logger';

/**
 * Generic, production-ready adapter for hazard sources that require a
 * per-deployment endpoint + API key (state disaster management bulletins,
 * river gauge telemetry, power utility outage feeds — none of these expose
 * a standardized public API, unlike USGS/Open-Meteo).
 *
 * This is a REAL, working HTTP integration (auth header injection, timeout,
 * error handling, normalization) — not a mock. What it needs from you:
 *
 *   1. The upstream endpoint + API key, entered via the admin console
 *      (POST /api/admin/integrations/:key) — stored envelope-encrypted.
 *   2. The upstream response to match the `UpstreamHazardItem` contract
 *      below, OR a small `transformResponse` function if their schema
 *      differs (pass one when constructing the adapter).
 *
 * Until #1 is done, `isConfigured()` returns false and `fetchAlerts()`
 * returns [] — the UI shows "not connected", never fabricated entries.
 * See docs/INTEGRATIONS.md for the full runbook per source.
 */

export interface UpstreamHazardItem {
  id: string;
  regionCode: string; // must map to a seeded Region.code (e.g. "ASM", "ASM-DIBRUGARH")
  hazardType: HazardType;
  severity: Severity;
  title: string;
  description: string;
  effectiveAt: string; // ISO 8601
  expiresAt?: string;
  bulletinUrl?: string;
}

interface GenericAdapterConfig {
  integrationKey: string; // matches IntegrationCredential.integrationKey
  displayName: string;
  sourceType: AlertSourceType;
  sourceName: string;
  transformResponse?: (raw: unknown) => UpstreamHazardItem[];
}

interface StoredCredentialPayload {
  baseUrl: string;
  apiKey: string;
  headerName?: string; // defaults to 'Authorization: Bearer <key>' if omitted
}

function defaultTransform(raw: unknown): UpstreamHazardItem[] {
  if (Array.isArray(raw)) return raw as UpstreamHazardItem[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
    return (raw as { items: UpstreamHazardItem[] }).items;
  }
  throw new Error('Unrecognized upstream response shape — provide a transformResponse function');
}

export function createGenericHttpHazardAdapter(config: GenericAdapterConfig): AlertSourceAdapter {
  async function loadCredential(): Promise<StoredCredentialPayload | null> {
    const row = await prisma.integrationCredential.findUnique({
      where: { integrationKey: config.integrationKey },
    });
    if (!row || !row.isConfigured) return null;
    try {
      return JSON.parse(decryptSecret(row.encryptedPayload)) as StoredCredentialPayload;
    } catch (err) {
      logger.error({ err, key: config.integrationKey }, 'failed to decrypt integration credential');
      return null;
    }
  }

  return {
    key: config.integrationKey,
    displayName: config.displayName,

    async isConfigured() {
      return (await loadCredential()) !== null;
    },

    async fetchAlerts(): Promise<NormalizedAlert[]> {
      const cred = await loadCredential();
      if (!cred) {
        logger.debug({ key: config.integrationKey }, 'integration not configured, skipping poll');
        return [];
      }

      const headerName = cred.headerName ?? 'Authorization';
      const headerValue = cred.headerName ? cred.apiKey : `Bearer ${cred.apiKey}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(cred.baseUrl, {
          headers: { [headerName]: headerValue, Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`${config.displayName} returned HTTP ${res.status}`);
        }
        const raw = await res.json();
        const items = (config.transformResponse ?? defaultTransform)(raw);

        return items.map((item) => ({
          hazardType: item.hazardType,
          severity: item.severity,
          regionCode: item.regionCode,
          title: item.title,
          description: item.description,
          sourceType: config.sourceType,
          sourceName: config.sourceName,
          sourceUrl: item.bulletinUrl,
          externalId: item.id,
          effectiveAt: new Date(item.effectiveAt),
          expiresAt: item.expiresAt ? new Date(item.expiresAt) : undefined,
        }));
      } catch (err) {
        logger.error({ err, key: config.integrationKey }, 'integration poll failed');
        return [];
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
