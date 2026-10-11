import type { Env } from "./env.ts";
import type { Weather, WeatherReport } from "./types.ts";

const KEY = "weather:v1";
const ATTEMPT_KEY = "weather:attempt";
const UA = "dan-town-weather (+https://github.com/dannguyen111)";
/** How long a reading counts as current. Refreshes only happen when someone visits. */
const FRESH_MS = 30 * 60_000;

export const EMPTY_WEATHER: WeatherReport = { weather: null, isDay: null, updatedAt: null };

/** WMO weather interpretation codes (as Open-Meteo reports them), folded into what the town can draw. */
export function wmoToWeather(code: number): Weather {
  if (code === 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code === 95 || code === 96 || code === 99) return "storm";
  return "clear";
}

async function fetchWeather(lat: string, lon: string): Promise<WeatherReport> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=weather_code,is_day`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`open-meteo: HTTP ${res.status}`);
  const { current } = await res.json<{ current: { weather_code: number; is_day: number } }>();
  return { weather: wmoToWeather(current.weather_code), isDay: current.is_day === 1, updatedAt: new Date().toISOString() };
}

/** Fetch and store a new reading. On failure the previous one stays. */
async function refreshWeather(env: Env, lat: string, lon: string): Promise<WeatherReport | null> {
  try {
    const next = await fetchWeather(lat, lon);
    await env.STATS.put(KEY, JSON.stringify(next));
    return next;
  } catch (err) {
    console.warn("[weather] refresh failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * The weather in Dan's city. A stale reading is served straight away while one background refresh (at
 * most one per two minutes) replaces it; only an empty cache makes the visitor wait for Open-Meteo.
 */
export async function readWeather(env: Env, ctx: ExecutionContext): Promise<WeatherReport> {
  const { WEATHER_LAT: lat, WEATHER_LON: lon } = env;
  if (!lat || !lon) return EMPTY_WEATHER;
  const cached = await env.STATS.get<WeatherReport>(KEY, "json");
  if (!cached) return (await refreshWeather(env, lat, lon)) ?? EMPTY_WEATHER;
  const age = Date.now() - Date.parse(cached.updatedAt ?? "");
  if (age < FRESH_MS) return cached;
  if (!(await env.STATS.get(ATTEMPT_KEY))) {
    await env.STATS.put(ATTEMPT_KEY, "1", { expirationTtl: 120 });
    ctx.waitUntil(refreshWeather(env, lat, lon));
  }
  return cached;
}
