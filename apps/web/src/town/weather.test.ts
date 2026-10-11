import { describe, expect, it } from "vitest";
import { WEATHER_FRAME_MS, WEATHER_WASH, animated, drawWeather, flashOn, mixWashes, parseWeatherParam, particleAt } from "./weather.ts";

describe("?weather= override", () => {
  it.each(["clear", "clouds", "fog", "rain", "storm", "snow"] as const)("reads %s", (w) => {
    expect(parseWeatherParam(`?weather=${w}`)).toBe(w);
  });

  it("ignores a missing or unknown kind", () => {
    expect(parseWeatherParam("")).toBeNull();
    expect(parseWeatherParam("?weather=hail")).toBeNull();
    expect(parseWeatherParam("?time=21:30")).toBeNull();
  });
});

describe("washes", () => {
  it("passes a single wash through unchanged", () => {
    expect(mixWashes(null, null)).toBeNull();
    expect(mixWashes("rgba(1, 2, 3, 0.5)", null)).toBe("rgba(1, 2, 3, 0.5)");
    expect(mixWashes(null, WEATHER_WASH.rain)).toBe(WEATHER_WASH.rain);
  });

  it("matches painting one wash over the other", () => {
    // Black at 0.5 under white at 0.5: 0.75 opaque, two thirds white.
    expect(mixWashes("rgba(0, 0, 0, 0.5)", "rgba(255, 255, 255, 0.5)")).toBe("rgba(170, 170, 170, 0.75)");
    expect(mixWashes("rgba(255, 255, 255, 0.5)", "rgba(0, 0, 0, 0.5)")).toBe("rgba(85, 85, 85, 0.75)");
  });

  it("leaves clear skies unwashed and washes every other kind", () => {
    expect(WEATHER_WASH.clear).toBeNull();
    for (const w of ["clouds", "fog", "rain", "storm", "snow"] as const) expect(WEATHER_WASH[w]).toMatch(/^rgba\(/);
  });

  it("animates only falling weather", () => {
    expect([null, "clear", "clouds", "fog", "rain", "storm", "snow"].filter((w) => animated(w as never))).toEqual(["rain", "storm", "snow"]);
  });
});

describe("particles", () => {
  it.each(["rain", "snow"] as const)("%s stays inside the view and is the same for the same moment", (kind) => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 0 };
    for (let i = 0; i < 50; i++)
      for (const t of [0, 1234, 987_654_321]) {
        particleAt(i, t, kind, 300, 200, a);
        particleAt(i, t, kind, 300, 200, b);
        expect(a).toEqual(b);
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x).toBeLessThan(300);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeLessThan(200);
      }
  });

  it("rain moves between frames", () => {
    const a = particleAt(0, 0, "rain", 300, 200, { x: 0, y: 0 });
    const b = particleAt(0, WEATHER_FRAME_MS, "rain", 300, 200, { x: 0, y: 0 });
    expect(b).not.toEqual(a);
  });
});

describe("drawWeather", () => {
  const record = () => {
    const calls: string[] = [];
    const ctx = {
      set fillStyle(v: string) {
        calls.push(v);
      },
      fillRect: (...r: number[]) => void calls.push(r.join(",")),
    } as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  };
  const view = { x: 10, y: 20, w: 300, h: 200 };

  it.each(["rain", "storm", "snow", "fog"] as const)("with reduced motion, %s is the same frame at any moment, with no flash", (w) => {
    const a = record();
    const b = record();
    drawWeather(a.ctx, w, 0, view, true);
    drawWeather(b.ctx, w, 123_456, view, true);
    expect(a.calls).toEqual(b.calls);
    expect(a.calls).not.toContain("rgba(255, 255, 255, 0.35)");
  });

  it("flashes in a storm only on a lightning frame", () => {
    const lit = record();
    const dark = record();
    drawWeather(lit.ctx, "storm", 0, view, false);
    drawWeather(dark.ctx, "storm", WEATHER_FRAME_MS, view, false);
    expect(lit.calls).toContain("rgba(255, 255, 255, 0.35)");
    expect(dark.calls).not.toContain("rgba(255, 255, 255, 0.35)");
  });

  it.each([null, "clear", "clouds"] as const)("draws nothing over the town for %s", (w) => {
    const r = record();
    drawWeather(r.ctx, w, 1000, view, false);
    expect(r.calls).toEqual([]);
  });
});

describe("lightning", () => {
  it("flashes at most once in any second, and seconds apart", () => {
    const flashes: number[] = [];
    for (let t = 0; t < 60_000; t += WEATHER_FRAME_MS) if (flashOn(t)) flashes.push(t);
    expect(flashes.length).toBeGreaterThan(0);
    for (let i = 1; i < flashes.length; i++) expect(flashes[i]! - flashes[i - 1]!).toBeGreaterThanOrEqual(5000);
  });
});
