import { AlertSourceType, HazardType, Severity } from '@prisma/client';
import type { AlertSourceAdapter, NormalizedAlert } from './types';
import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';

const NE_INDIA_BBOX = { minLat: 20.5, maxLat: 29.8, minLon: 88.0, maxLon: 97.8 };
const LOOKBACK_DAYS = 30;
const MIN_MAGNITUDE = 2.5;

interface UsgsFeature {
  id: string;
  properties: { mag: number; place: string; time: number; url: string };
  geometry: { coordinates: [number, number, number] };
}

function severityForMagnitude(mag: number): Severity {
  if (mag >= 5) return Severity.SEVERE;
  if (mag >= 4) return Severity.WARNING;
  return Severity.ADVISORY;
}

/** Assigns an earthquake to the nearest seeded state region, for linking to Region.code. */
async function nearestStateRegion(lat: number, lon: number): Promise<string | null> {
  const states = await prisma.region.findMany({ where: { type: 'STATE' } });
  let best: { code: string; dist: number } | null = null;
  for (const s of states) {
    const dist = Math.hypot(s.lat - lat, s.lon - lon);
    if (!best || dist < best.dist) best = { code: s.code, dist };
  }
  // Only attribute to a state if reasonably close (~2.5 degrees ≈ 275km); otherwise skip.
  return best && best.dist < 2.5 ? best.code : null;
}

export const usgsEarthquakeAdapter: AlertSourceAdapter = {
  key: 'usgs_earthquake',
  displayName: 'USGS Earthquake Hazards Program',

  async isConfigured() {
    return true; // public API, no credentials required
  },

  async fetchAlerts(): Promise<NormalizedAlert[]> {
    const end = new Date();
    const start = new Date(end.getTime() - LOOKBACK_DAYS * 86400 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 19);

    const url =
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson` +
      `&starttime=${fmt(start)}&endtime=${fmt(end)}` +
      `&minlatitude=${NE_INDIA_BBOX.minLat}&maxlatitude=${NE_INDIA_BBOX.maxLat}` +
      `&minlongitude=${NE_INDIA_BBOX.minLon}&maxlongitude=${NE_INDIA_BBOX.maxLon}` +
      `&minmagnitude=${MIN_MAGNITUDE}&orderby=time&limit=50`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let features: UsgsFeature[];
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`USGS returned HTTP ${res.status}`);
      const body = (await res.json()) as { features: UsgsFeature[] };
      features = body.features;
    } finally {
      clearTimeout(timeout);
    }

    const results: NormalizedAlert[] = [];
    for (const f of features) {
      const [lon, lat] = f.geometry.coordinates;
      const regionCode = await nearestStateRegion(lat, lon);
      if (!regionCode) continue; // outside any tracked state's catchment — skip rather than mis-attribute

      results.push({
        hazardType: HazardType.EARTHQUAKE,
        severity: severityForMagnitude(f.properties.mag),
        regionCode,
        title: `M${f.properties.mag.toFixed(1)} earthquake — ${f.properties.place}`,
        description: `Magnitude ${f.properties.mag.toFixed(1)} earthquake reported ${f.properties.place}.`,
        sourceType: AlertSourceType.LIVE_API,
        sourceName: 'USGS Earthquake Hazards Program',
        sourceUrl: f.properties.url,
        externalId: f.id, // USGS's stable event id — safe for idempotent upsert across polls
        effectiveAt: new Date(f.properties.time),
      });
    }

    logger.debug({ count: results.length }, 'usgs adapter fetched alerts');
    return results;
  },
};
