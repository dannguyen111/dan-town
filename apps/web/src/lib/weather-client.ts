import type { WeatherReport } from "@dan-town/api/types";
import { forcedWeather } from "../town/weather";

/** How long one answer is reused before asking the worker again. */
const REUSE_MS = 15 * 60_000;

let pending: Promise<WeatherReport | null> | null = null;
let fetchedAt = 0;
let lastGood: WeatherReport | null = null;

/**
 * The weather in Dan's city, or null when it has never been available (the town then stays clear). A
 * failed check keeps the last good report, so a blip doesn't clear the rain.
 */
export function loadWeather(): Promise<WeatherReport | null> {
  if (forcedWeather) return Promise.resolve({ weather: forcedWeather, isDay: null, updatedAt: null });
  if (!pending || Date.now() - fetchedAt > REUSE_MS) {
    fetchedAt = Date.now();
    pending = fetch("/api/weather", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? (r.json() as Promise<WeatherReport>) : null))
      .catch(() => null)
      .then((report) => (lastGood = report ?? lastGood));
  }
  return pending;
}
