import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Region, Alert } from '../../lib/queries';

const SEVERITY_COLOR: Record<string, string> = {
  NONE: '#5f7a80',
  ADVISORY: '#f4d13f',
  WARNING: '#ff9a3c',
  SEVERE: '#ff4d4d',
};

function severityForRegion(regionCode: string, alerts: Alert[]): string {
  const rank: Record<string, number> = { ADVISORY: 1, WARNING: 2, SEVERE: 3 };
  let best = 'NONE';
  let bestRank = 0;
  for (const a of alerts) {
    if (a.regionCode !== regionCode) continue;
    if (rank[a.severity] > bestRank) {
      bestRank = rank[a.severity];
      best = a.severity;
    }
  }
  return best;
}

interface Props {
  regions: Region[];
  alerts: Alert[];
  onSelectRegion: (code: string) => void;
}

/**
 * Uses MapLibre's free OpenStreetMap-derived demo style tiles for this
 * scaffold. For production, point `style` at your own tile provider
 * (MapTiler, Stadia Maps, or a self-hosted tileserver) — see
 * docs/DEPLOYMENT.md "Map tiles" section for options and licensing notes.
 */
export function RegionMap({ regions, alerts, onSelectRegion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [92.9, 25.8],
      zoom: 5.2,
      attributionControl: true,
    });
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const region of regions.filter((r) => r.type === 'STATE')) {
      const severity = severityForRegion(region.code, alerts);
      const el = document.createElement('button');
      el.setAttribute('aria-label', `${region.name} — current severity: ${severity.toLowerCase()}`);
      el.style.width = '18px';
      el.style.height = '18px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.15)';
      el.style.background = SEVERITY_COLOR[severity];
      el.style.cursor = 'pointer';
      el.onclick = () => onSelectRegion(region.code);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([region.lon, region.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setText(region.name))
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [regions, alerts, onSelectRegion]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Map of Northeast India showing current hazard severity by state"
      className="h-full w-full rounded-xl"
    />
  );
}
