import { describe, expect, it } from "vitest";
import { quantile, summarize } from "./traces.ts";
import type { Trace } from "./types.ts";

const NOW = Date.parse("2026-10-06T12:00:00Z");
const trace = (over: Partial<Trace>): Trace => ({ id: "a", at: "2026-10-06T11:00:00Z", model: "m", totalMs: 1000, ok: true, cost: null, rounds: [], ...over });
const round = (inTok: number | null, cached: number | null, tools: string[] = []) => ({
  t0: 0,
  ms: 100,
  ttftMs: 50,
  in: inTok,
  cached,
  out: 10,
  tools: tools.map((name) => ({ name, t0: 0, ms: 5, ok: true })),
});

describe("quantile", () => {
  it("uses nearest rank", () => {
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([10], 0.95)).toBe(10);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
  });
});

describe("summarize", () => {
  it("counts recent runs, latency of successful runs, cache hits, cost and tools", () => {
    const s = summarize(
      [
        trace({ totalMs: 800, cost: 0.002, rounds: [round(1000, 750, ["check_time"]), round(1000, 1000)] }),
        trace({ totalMs: 1200, cost: null, rounds: [round(null, null)] }),
        trace({ totalMs: 9000, ok: false, at: "2026-10-04T00:00:00Z", rounds: [round(500, 0, ["check_time", "check_availability"])] }),
      ],
      NOW,
    );
    expect(s).toEqual({
      runs24h: 2,
      p50Ms: 800,
      p95Ms: 1200,
      cacheHit: 1750 / 2500,
      avgCost: 0.002,
      tools: { check_time: 2, check_availability: 1 },
    });
  });

  it("is empty without traces", () => {
    expect(summarize([], NOW)).toEqual({ runs24h: 0, p50Ms: null, p95Ms: null, cacheHit: null, avgCost: null, tools: {} });
  });
});
