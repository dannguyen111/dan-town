import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env.ts";
import type { WeatherReport } from "./types.ts";
import { EMPTY_WEATHER, readWeather, wmoToWeather } from "./weather.ts";

function kv(initial: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
  return {
    store,
    get: vi.fn(async (key: string, type?: string) => {
      const v = store.get(key);
      return v === undefined ? null : type === "json" ? JSON.parse(v) : v;
    }),
    put: vi.fn(async (key: string, value: string) => void store.set(key, value)),
  };
}

const env = (STATS: ReturnType<typeof kv>, coords = true) =>
  ({ STATS, ...(coords ? { WEATHER_LAT: "40.71", WEATHER_LON: "-74.01" } : {}) }) as unknown as Env;
const ctx = () => ({ waitUntil: vi.fn() }) as unknown as ExecutionContext & { waitUntil: ReturnType<typeof vi.fn> };
const openMeteo = (code: number, isDay = 1) => new Response(JSON.stringify({ current: { weather_code: code, is_day: isDay } }));
const reading = (weather: WeatherReport["weather"], minutesAgo: number): WeatherReport => ({
  weather,
  isDay: true,
  updatedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
});

afterEach(() => vi.unstubAllGlobals());

describe("wmoToWeather", () => {
  it.each([
    [0, "clear"],
    [2, "clear"],
    [3, "clouds"],
    [45, "fog"],
    [48, "fog"],
    [51, "rain"],
    [67, "rain"],
    [80, "rain"],
    [82, "rain"],
    [71, "snow"],
    [77, "snow"],
    [85, "snow"],
    [86, "snow"],
    [95, "storm"],
    [99, "storm"],
    [42, "clear"],
  ] as const)("code %i is %s", (code, weather) => {
    expect(wmoToWeather(code)).toBe(weather);
  });
});

describe("readWeather", () => {
  it("does nothing without a configured city", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = kv();
    expect(await readWeather(env(store, false), ctx())).toEqual(EMPTY_WEATHER);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get).not.toHaveBeenCalled();
  });

  it("serves a fresh reading without calling Open-Meteo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const fresh = reading("rain", 5);
    expect(await readWeather(env(kv({ "weather:v1": fresh })), ctx())).toEqual(fresh);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches and stores a reading when the cache is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openMeteo(73, 0));
    vi.stubGlobal("fetch", fetchMock);
    const store = kv();
    const out = await readWeather(env(store), ctx());
    expect(out).toMatchObject({ weather: "snow", isDay: false });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("latitude=40.71");
    expect(JSON.parse(store.store.get("weather:v1")!)).toMatchObject({ weather: "snow" });
  });

  it("serves a stale reading and refreshes it in the background once", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openMeteo(0));
    vi.stubGlobal("fetch", fetchMock);
    const stale = reading("fog", 45);
    const store = kv({ "weather:v1": stale });
    const first = ctx();
    expect(await readWeather(env(store), first)).toEqual(stale);
    expect(first.waitUntil).toHaveBeenCalledTimes(1);
    await first.waitUntil.mock.calls[0]![0];
    expect(JSON.parse(store.store.get("weather:v1")!)).toMatchObject({ weather: "clear" });

    store.store.set("weather:v1", JSON.stringify(stale));
    const second = ctx();
    await readWeather(env(store), second);
    expect(second.waitUntil).not.toHaveBeenCalled();
  });

  it("keeps the old reading when Open-Meteo fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("down", { status: 503 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const stale = reading("storm", 90);
    const store = kv({ "weather:v1": stale });
    const c = ctx();
    expect(await readWeather(env(store), c)).toEqual(stale);
    await c.waitUntil.mock.calls[0]![0];
    expect(JSON.parse(store.store.get("weather:v1")!)).toEqual(stale);
  });

  it("drops a reading too old to trust while it refreshes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(openMeteo(0)));
    const c = ctx();
    expect(await readWeather(env(kv({ "weather:v1": reading("storm", 7 * 60) })), c)).toEqual(EMPTY_WEATHER);
    expect(c.waitUntil).toHaveBeenCalledTimes(1);
  });

  it("doesn't call Open-Meteo for an empty cache while a recent attempt is pending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await readWeather(env(kv({ "weather:attempt": "1" })), ctx())).toEqual(EMPTY_WEATHER);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to no weather when the first fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await readWeather(env(kv()), ctx())).toEqual(EMPTY_WEATHER);
  });
});
