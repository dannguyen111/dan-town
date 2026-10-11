import { describe, expect, it } from "vitest";
import { TOWN_TINT, easternTime, formatEastern, parseTimeParam, skyAt, skyNow } from "./sky.ts";

const at = (iso: string) => new Date(iso);

describe("eastern time", () => {
  it("reads the clock in New York, not the visitor's zone", () => {
    expect(easternTime(at("2026-07-01T16:05:00Z"))).toEqual({ h: 12, m: 5 }); // EDT
    expect(easternTime(at("2026-01-15T03:30:00Z"))).toEqual({ h: 22, m: 30 }); // EST
    expect(formatEastern(at("2026-01-15T05:07:00Z"))).toBe("12:07 AM");
  });

  it("skips the missing hour when clocks spring forward", () => {
    expect(easternTime(at("2026-03-08T06:59:00Z"))).toEqual({ h: 1, m: 59 });
    expect(easternTime(at("2026-03-08T07:00:00Z"))).toEqual({ h: 3, m: 0 });
  });

  it("repeats an hour when clocks fall back", () => {
    expect(easternTime(at("2026-11-01T05:30:00Z"))).toEqual({ h: 1, m: 30 });
    expect(easternTime(at("2026-11-01T06:30:00Z"))).toEqual({ h: 1, m: 30 });
  });
});

describe("sky buckets", () => {
  it.each([
    [0, "night"],
    [4.99, "night"],
    [5, "dawn"],
    [6.99, "dawn"],
    [7, "day"],
    [16.99, "day"],
    [17, "dusk"],
    [19.99, "dusk"],
    [20, "night"],
    [23.99, "night"],
  ] as const)("%s h is %s", (t, sky) => {
    expect(skyAt(t)).toBe(sky);
  });

  it("dawn comes an hour earlier in UTC once daylight saving starts", () => {
    expect(skyNow(at("2026-03-07T09:30:00Z"))).toBe("night"); // 4:30 EST
    expect(skyNow(at("2026-03-08T09:30:00Z"))).toBe("dawn"); // 5:30 EDT
    expect(skyNow(at("2026-03-08T20:59:00Z"))).toBe("day"); // 4:59 PM EDT
    expect(skyNow(at("2026-03-08T21:00:00Z"))).toBe("dusk"); // 5:00 PM EDT
  });

  it("dawn comes an hour later in UTC once daylight saving ends", () => {
    expect(skyNow(at("2026-10-31T09:30:00Z"))).toBe("dawn"); // 5:30 EDT
    expect(skyNow(at("2026-11-01T09:30:00Z"))).toBe("night"); // 4:30 EST
    expect(skyNow(at("2026-11-02T00:59:00Z"))).toBe("dusk"); // 7:59 PM EST
    expect(skyNow(at("2026-11-02T01:00:00Z"))).toBe("night"); // 8:00 PM EST
  });

  it("leaves the town untinted by day and tints every other sky", () => {
    expect(TOWN_TINT.day).toBeNull();
    for (const sky of ["night", "dawn", "dusk"] as const) expect(TOWN_TINT[sky]).toMatch(/^rgba\(/);
  });
});

describe("?time= override", () => {
  it("reads a 24-hour time", () => {
    expect(parseTimeParam("?time=21:30")).toEqual({ h: 21, m: 30 });
    expect(parseTimeParam("?foo=1&time=6:05")).toEqual({ h: 6, m: 5 });
  });

  it("ignores a missing or impossible time", () => {
    expect(parseTimeParam("")).toBeNull();
    expect(parseTimeParam("?time=24:00")).toBeNull();
    expect(parseTimeParam("?time=12:60")).toBeNull();
    expect(parseTimeParam("?time=noon")).toBeNull();
  });
});
