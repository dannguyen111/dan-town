import type { WeatherReport } from "@dan-town/api/types";
import { forcedWeather } from "../town/weather";

/** How long one answer is reused before asking the worker again. */
const REUSE_MS = 15 * 60_000;

let pending: Promise<WeatherReport | null> | null = null;
let fetchedAt = 0;

/** The weather in Dan's city, or null when it's unavailable (the town then stays clear). */
export function loadWeather(): Promise<WeatherReport | null> {
  if (forcedWeather) return Promise.resolve({ weather: forcedWeather, isDay: null, updatedAt: null });
  if (!pending || Date.now() - fetchedAt > REUSE_MS) {
    fetchedAt = Date.now();
    pending = fetch("/api/weather", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? (r.json() as Promise<WeatherReport>) : null))
      .catch(() => null);
  }
  return pending;
}
