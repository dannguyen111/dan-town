import { describe, expect, it } from "vitest";
import { fmtCost, fmtMs, fmtPct, fmtTok, roundSummary } from "./traces.ts";

describe("trace formatting", () => {
  it("formats times, tokens, shares and cost", () => {
    expect([fmtMs(412), fmtMs(1940), fmtMs(null)]).toEqual(["412ms", "1.9s", "–"]);
    expect([fmtTok(58), fmtTok(3140), fmtTok(null)]).toEqual(["58", "3.1k", "–"]);
    expect([fmtPct(0.836), fmtPct(null)]).toEqual(["84%", "–"]);
    expect([fmtCost(0.0004), fmtCost(0.025), fmtCost(null)]).toEqual(["0.04¢", "$0.025", "–"]);
  });

  it("summarises a round with its cache hit rate", () => {
    const r = { t0: 0, ms: 412, ttftMs: 200, in: 3100, cached: 2600, out: 58, tools: [] };
    expect(roundSummary(r, 0)).toBe("r1 412ms 3.1k→58 ⚡84%");
    expect(roundSummary({ ...r, in: null, cached: null }, 1)).toBe("r2 412ms –→58");
  });
});
