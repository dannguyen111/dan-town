import { describe, expect, it } from "vitest";
import { checkTime, ET, findSlots, formatSlot, isTimeZone, parseLocal, toSlot, zonedToUtc } from "./schedule.ts";

const t = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString();
// Monday, Oct 5 2026, 8:00 AM EDT.
const NOW = t("2026-10-05T12:00:00Z");

describe("time zones", () => {
  it("converts Eastern wall-clock time across the DST change (Nov 1 2026)", () => {
    expect(iso(zonedToUtc(2026, 10, 7, 9, 0, ET))).toBe("2026-10-07T13:00:00.000Z"); // EDT
    expect(iso(zonedToUtc(2026, 11, 2, 9, 0, ET))).toBe("2026-11-02T14:00:00.000Z"); // EST
    expect(iso(zonedToUtc(2026, 10, 7, 9, 0, "Asia/Tokyo"))).toBe("2026-10-07T00:00:00.000Z");
  });

  it("parses a visitor's local time and validates zones", () => {
    expect(iso(parseLocal("2026-10-07T19:30", "Europe/London")!)).toBe("2026-10-07T18:30:00.000Z");
    expect(parseLocal("next tuesday", ET)).toBeNull();
    expect(parseLocal("2026-13-07T19:30", ET)).toBeNull();
    expect(isTimeZone("America/Los_Angeles")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isTimeZone(42)).toBe(false);
  });

  it("labels slots in ET and the visitor's zone", () => {
    expect(formatSlot(t("2026-10-07T13:00:00Z"), ET)).toBe("Wed, Oct 7, 9:00 AM EDT");
    expect(toSlot(t("2026-10-07T13:00:00Z"), 30, "America/Los_Angeles")).toEqual({
      start: "2026-10-07T13:00:00.000Z",
      duration: 30,
      et: "Wed, Oct 7, 9:00 AM EDT",
      local: "Wed, Oct 7, 6:00 AM PDT",
    });
  });
});

describe("checkTime", () => {
  const at = (s: string) => t(s); // UTC; EDT = UTC-4 in October
  it.each([
    ["Tue 9:00 AM (core)", "2026-10-06T13:00:00Z", 30, { ok: true, kind: "core" }],
    ["Fri 4:45 PM, 15 min (core, ends 5 PM)", "2026-10-09T20:45:00Z", 15, { ok: true, kind: "core" }],
    ["Wed 7:30 PM (evening, custom)", "2026-10-07T23:30:00Z", 30, { ok: true, kind: "custom" }],
    ["Wed 7:30 AM (early, custom)", "2026-10-07T11:30:00Z", 15, { ok: true, kind: "custom" }],
    ["Wed 11:30 PM, ends at midnight", "2026-10-08T03:30:00Z", 30, { ok: true, kind: "custom" }],
    ["Wed 11:45 PM, runs past midnight", "2026-10-08T03:45:00Z", 30, { ok: false, reason: "outside_hours" }],
    ["Wed 7:15 AM", "2026-10-07T11:15:00Z", 15, { ok: false, reason: "outside_hours" }],
    ["Fri 6 PM (no Friday evenings)", "2026-10-09T22:00:00Z", 30, { ok: false, reason: "outside_hours" }],
    ["Fri 4:45 PM, 30 min (runs past 5)", "2026-10-09T20:45:00Z", 30, { ok: false, reason: "outside_hours" }],
    ["Sat 10 AM", "2026-10-10T14:00:00Z", 30, { ok: false, reason: "outside_hours" }],
    ["Tue 7:30 AM (under 24h notice)", "2026-10-06T11:30:00Z", 30, { ok: false, reason: "too_soon" }],
    ["15 days out", "2026-10-20T14:00:00Z", 30, { ok: false, reason: "too_far" }],
    ["45 minutes", "2026-10-07T14:00:00Z", 45, { ok: false, reason: "bad_duration" }],
  ])("%s", (_label, start, duration, expected) => {
    expect(checkTime(at(start), duration, [], NOW)).toEqual(expected);
  });

  it("rejects times that overlap a busy block", () => {
    const busy = [{ start: t("2026-10-07T14:00:00Z"), end: t("2026-10-07T15:00:00Z") }];
    expect(checkTime(t("2026-10-07T13:45:00Z"), 30, busy, NOW)).toEqual({ ok: false, reason: "busy" });
    expect(checkTime(t("2026-10-07T13:30:00Z"), 30, busy, NOW)).toEqual({ ok: true, kind: "core" }); // ends as busy starts
  });

  it("uses EST hours after the clocks change", () => {
    const now = t("2026-10-30T12:00:00Z");
    expect(checkTime(t("2026-11-02T14:00:00Z"), 30, [], now)).toEqual({ ok: true, kind: "core" }); // 9 AM EST
    expect(checkTime(t("2026-11-02T13:30:00Z"), 30, [], now)).toEqual({ ok: true, kind: "custom" }); // 8:30 AM EST
  });
});

describe("findSlots", () => {
  const week = { from: NOW, to: NOW + 7 * 86_400_000, duration: 30 as const, now: NOW };

  it("offers spread-out weekday core-hour slots, starting after the notice period", () => {
    expect(findSlots({ ...week, busy: [] }).map(iso)).toEqual([
      "2026-10-06T13:00:00.000Z", // Tue 9 AM
      "2026-10-06T16:00:00.000Z", // Tue 12 PM
      "2026-10-07T13:00:00.000Z",
      "2026-10-07T16:00:00.000Z",
      "2026-10-08T13:00:00.000Z",
      "2026-10-08T16:00:00.000Z",
    ]);
  });

  it("skips busy times and weekends", () => {
    const busy = [{ start: t("2026-10-06T12:00:00Z"), end: t("2026-10-06T21:00:00Z") }]; // all of Tuesday
    const slots = findSlots({ ...week, busy, from: t("2026-10-06T00:00:00Z"), limit: 3 }).map(iso);
    expect(slots).toEqual(["2026-10-07T13:00:00.000Z", "2026-10-07T16:00:00.000Z", "2026-10-08T13:00:00.000Z"]);
    const fri = findSlots({ ...week, busy: [], from: t("2026-10-09T17:00:00Z"), to: t("2026-10-13T00:00:00Z"), limit: 2, perDay: 1 }).map(iso);
    expect(fri).toEqual(["2026-10-09T17:00:00.000Z", "2026-10-12T13:00:00.000Z"]); // Fri 1 PM, then Monday
  });

  it("never goes past the horizon", () => {
    expect(findSlots({ ...week, busy: [], from: t("2026-10-19T00:00:00Z"), to: t("2026-10-30T00:00:00Z") })).toEqual([]);
  });
});
