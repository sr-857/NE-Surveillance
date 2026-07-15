import { AlertSourceType, HazardType } from '@prisma/client';
import type { AlertSourceAdapter } from './types';
import { usgsEarthquakeAdapter } from './usgsEarthquake.adapter';
import { createGenericHttpHazardAdapter } from './genericHttpHazard.adapter';

const asdmaAdapter = createGenericHttpHazardAdapter({
  integrationKey: 'asdma_bulletins',
  displayName: 'ASDMA Flood & Landslide Bulletins',
  sourceType: AlertSourceType.WEBHOOK,
  sourceName: 'Assam State Disaster Management Authority',
});

const cwcAdapter = createGenericHttpHazardAdapter({
  integrationKey: 'cwc_river_levels',
  displayName: 'Central Water Commission — Danger Mark Bulletins',
  sourceType: AlertSourceType.WEBHOOK,
  sourceName: 'Central Water Commission (CWC)',
});

const apdclAdapter = createGenericHttpHazardAdapter({
  integrationKey: 'apdcl_outages',
  displayName: 'APDCL Power Outage Feed',
  sourceType: AlertSourceType.WEBHOOK,
  sourceName: 'Assam Power Distribution Company Ltd (APDCL)',
});

/**
 * The full set of hazard sources polled by the scheduler. Adding a new
 * region's disaster-management or utility feed is a matter of adding one
 * `createGenericHttpHazardAdapter(...)` call here plus its credential —
 * no other code changes required.
 */
export const alertAdapters: AlertSourceAdapter[] = [
  usgsEarthquakeAdapter,
  asdmaAdapter,
  cwcAdapter,
  apdclAdapter,
];

export const supportedHazardTypesByAdapter: Record<string, HazardType[]> = {
  usgs_earthquake: [HazardType.EARTHQUAKE],
  asdma_bulletins: [HazardType.FLOOD, HazardType.LANDSLIDE],
  cwc_river_levels: [HazardType.FLOOD],
  apdcl_outages: [HazardType.POWER_OUTAGE],
};
