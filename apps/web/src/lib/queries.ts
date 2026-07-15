import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './apiClient';

export interface WeatherReading {
  regionCode: string;
  temperatureC: number;
  precipitationMm: number;
  windKph: number;
  humidityPct: number;
  conditionCode: number;
  dailyPrecipMm: number[];
  fetchedAt: string;
  provider: 'open-meteo';
}

export interface Alert {
  id: string;
  hazardType: string;
  severity: 'ADVISORY' | 'WARNING' | 'SEVERE';
  regionCode: string;
  title: string;
  description: string;
  sourceType: 'LIVE_API' | 'MANUAL_ENTRY' | 'WEBHOOK';
  sourceName: string;
  sourceUrl?: string;
  effectiveAt: string;
  region: { name: string; lat: number; lon: number };
}

export interface Region {
  code: string;
  name: string;
  type: 'STATE' | 'DISTRICT';
  lat: number;
  lon: number;
}

export function useWeather() {
  return useQuery({
    queryKey: ['weather', 'all'],
    queryFn: () => apiFetch<{ data: WeatherReading[] }>('/weather').then((r) => r.data),
    // Matches the backend's 5-minute refresh cadence — no point polling faster.
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}

export function useAlerts(params?: { regionCode?: string; activeOnly?: boolean }) {
  const qs = new URLSearchParams();
  if (params?.regionCode) qs.set('regionCode', params.regionCode);
  if (params?.activeOnly !== undefined) qs.set('activeOnly', String(params.activeOnly));

  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => apiFetch<{ data: Alert[] }>(`/alerts?${qs.toString()}`).then((r) => r.data),
    refetchInterval: 60 * 1000,
  });
}

export function useRegions(type?: 'STATE' | 'DISTRICT') {
  return useQuery({
    queryKey: ['regions', type],
    queryFn: () => apiFetch<{ data: Region[] }>(`/regions${type ? `?type=${type}` : ''}`).then((r) => r.data),
    staleTime: Infinity, // reference data — effectively static
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, note }: { alertId: string; note?: string }) =>
      apiFetch(`/alerts/${alertId}/acknowledge`, { method: 'POST', body: JSON.stringify({ note }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
