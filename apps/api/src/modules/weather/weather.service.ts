import { prisma } from '../../lib/prisma';
import { cached } from '../../lib/redis';
import { ApiError } from '../../lib/apiError';
import { logger } from '../../lib/logger';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_SECONDS = 5 * 60; // matches the 5-minute refresh cadence

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

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
  };
  daily: {
    precipitation_sum: number[];
  };
}

async function fetchFromProvider(lat: number, lon: number): Promise<OpenMeteoResponse> {
  const url =
    `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m` +
    `&daily=precipitation_sum&forecast_days=7&timezone=Asia%2FKolkata`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new ApiError(502, 'WEATHER_PROVIDER_ERROR', `Open-Meteo returned HTTP ${res.status}`);
    return (await res.json()) as OpenMeteoResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getWeatherForRegion(regionCode: string): Promise<WeatherReading> {
  const region = await prisma.region.findUnique({ where: { code: regionCode } });
  if (!region) throw new ApiError(404, 'REGION_NOT_FOUND', `Unknown region code: ${regionCode}`);

  return cached(`weather:${regionCode}`, CACHE_TTL_SECONDS, async () => {
    const data = await fetchFromProvider(region.lat, region.lon);

    const reading: WeatherReading = {
      regionCode,
      temperatureC: data.current.temperature_2m,
      precipitationMm: data.current.precipitation,
      windKph: data.current.wind_speed_10m,
      humidityPct: data.current.relative_humidity_2m,
      conditionCode: data.current.weather_code,
      dailyPrecipMm: data.daily.precipitation_sum,
      fetchedAt: new Date().toISOString(),
      provider: 'open-meteo',
    };

    // Fire-and-forget durable write for trend history — must not block the response.
    prisma.weatherSnapshot
      .create({
        data: {
          regionCode,
          temperatureC: reading.temperatureC,
          precipitationMm: reading.precipitationMm,
          windKph: reading.windKph,
          humidityPct: reading.humidityPct,
          conditionCode: reading.conditionCode,
        },
      })
      .catch((err) => logger.error({ err, regionCode }, 'failed to persist weather snapshot'));

    return reading;
  });
}

export async function getWeatherForAllStates(): Promise<WeatherReading[]> {
  const states = await prisma.region.findMany({ where: { type: 'STATE' } });
  const results = await Promise.allSettled(states.map((s) => getWeatherForRegion(s.code)));
  return results
    .filter((r): r is PromiseFulfilledResult<WeatherReading> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export async function getWeatherTrend(regionCode: string, days = 7): Promise<
  { fetchedAt: Date; temperatureC: number; precipitationMm: number }[]
> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return prisma.weatherSnapshot.findMany({
    where: { regionCode, fetchedAt: { gte: since } },
    select: { fetchedAt: true, temperatureC: true, precipitationMm: true },
    orderBy: { fetchedAt: 'asc' },
  });
}
