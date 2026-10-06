/**
 * When Dan can meet. Pure functions over UTC instants, so they're easy to test (DST included).
 *
 * Dan's Google "Coffee Chat" appointment schedule can't be read through the Calendar API, so its
 * hours are mirrored here. Keep CORE in sync with that page. Busy times come from Google free/busy.
 *
 * - CORE: what the twin offers. Weekdays 9:00–17:00 ET.
 * - EXTENDED: what a visitor may propose when nothing in CORE works. Mon–Thu 7:30–24:00,
 *   Fri 7:30–17:00 ET (no Friday evenings), never weekends.
 * Every meeting needs NOTICE_H hours' notice and can be at most HORIZON_D days out.
 */

import type { Slot } from "./types.ts";

export const ET = "America/New_York";
export const DURATIONS = [15, 30] as const;
export type Duration = (typeof DURATIONS)[number];
export const NOTICE_H = 24;
export const HORIZON_D = 14;
export const SLOT_STEP = 15;

/** Minutes after midnight ET, per ISO weekday (1 = Monday … 7 = Sunday). [start, end) */
type Hours = Partial<Record<number, [number, number]>>;
const hm = (h: number, m = 0) => h * 60 + m;
const weekdays = (from: number, to: number): Hours => Object.fromEntries([1, 2, 3, 4, 5].map((d) => [d, [from, to]]));
export const CORE: Hours = weekdays(hm(9), hm(17));
export const EXTENDED: Hours = { ...weekdays(hm(7, 30), hm(24)), 5: [hm(7, 30), hm(17)] };

export const MEETING_LABEL: Record<Duration, string> = { 15: "15-min intro", 30: "30-min chat" };

export interface Interval {
  start: number; // epoch ms
  end: number;
}

export type { Slot };

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ───────────────────────────── time zones ─────────────────────────────

const partsFmt = new Map<string, Intl.DateTimeFormat>();
function parts(ms: number, tz: string) {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    partsFmt.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday!) + 1;
  return { y: +p.year!, mo: +p.month!, d: +p.day!, h: +p.hour!, mi: +p.minute!, weekday };
}

/** How far `tz` is ahead of UTC at instant `ms`, in ms. */
function offset(ms: number, tz: string): number {
  const p = parts(ms, tz);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(ms / MIN) * MIN;
}

/** Wall-clock time in `tz` → UTC epoch ms. In a DST gap the time moves forward, like a clock would. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - offset(guess, tz);
  return guess - offset(first, tz);
}

/** Parses "2026-10-07T19:30" (no zone) as wall-clock time in `tz`. */
export function parseLocal(s: string, tz: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::00)?$/.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  return zonedToUtc(y, mo, d, h, mi, tz);
}

export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function formatSlot(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(ms);
}

export const toSlot = (start: number, duration: Duration, tz: string, custom = false): Slot => ({
  start: new Date(start).toISOString(),
  duration,
  et: formatSlot(start, ET),
  local: formatSlot(start, tz),
  ...(custom ? { custom: true } : {}),
});

// ───────────────────────────── rules ─────────────────────────────

/** The [start, end) window, in UTC ms, that `hours` allows on the ET day containing `ms`. */
function windowOn(ms: number, hours: Hours): Interval | null {
  const p = parts(ms, ET);
  const w = hours[p.weekday];
  if (!w) return null;
  const at = (mins: number) => {
    // 24:00 is midnight at the start of the next day.
    const next = new Date(Date.UTC(p.y, p.mo - 1, p.d) + Math.floor(mins / 1440) * DAY);
    return zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), Math.floor((mins % 1440) / 60), mins % 60, ET);
  };
  return { start: at(w[0]), end: at(w[1]) };
}

const fits = (start: number, end: number, hours: Hours) => {
  const w = windowOn(start, hours);
  return !!w && start >= w.start && end <= w.end;
};

const overlaps = (a: Interval, busy: Interval[]) => busy.some((b) => a.start < b.end && b.start < a.end);

export const bookableRange = (now: number): Interval => ({ start: now + NOTICE_H * HOUR, end: now + HORIZON_D * DAY });

export type CheckResult =
  | { ok: true; kind: "core" | "custom" }
  | { ok: false; reason: "bad_duration" | "too_soon" | "too_far" | "outside_hours" | "busy" };

/** Can a meeting of `duration` minutes start at `start`? */
export function checkTime(start: number, duration: number, busy: Interval[], now: number): CheckResult {
  if (!(DURATIONS as readonly number[]).includes(duration)) return { ok: false, reason: "bad_duration" };
  const end = start + duration * MIN;
  const range = bookableRange(now);
  if (start < range.start) return { ok: false, reason: "too_soon" };
  if (start > range.end) return { ok: false, reason: "too_far" };
  const kind = fits(start, end, CORE) ? "core" : fits(start, end, EXTENDED) ? "custom" : null;
  if (!kind) return { ok: false, reason: "outside_hours" };
  if (overlaps({ start, end }, busy)) return { ok: false, reason: "busy" };
  return { ok: true, kind };
}

export const REASON_TEXT: Record<Exclude<CheckResult, { ok: true }>["reason"], string> = {
  bad_duration: "Meetings are 15 or 30 minutes.",
  too_soon: `Dan needs at least ${NOTICE_H} hours' notice.`,
  too_far: `Dan only books up to ${HORIZON_D} days ahead.`,
  outside_hours: "That's outside the hours Dan takes meetings (Mon–Thu 7:30 AM–midnight ET, Fri 7:30 AM–5 PM ET, no weekends).",
  busy: "Dan is busy then.",
};

/**
 * Free CORE-hours slots between `from` and `to`, spread out: at most `perDay` a day, at least
 * three hours apart, so a handful of chips covers mornings and afternoons across several days.
 */
export function findSlots(opts: {
  from: number;
  to: number;
  duration: Duration;
  busy: Interval[];
  now: number;
  limit?: number;
  perDay?: number;
}): number[] {
  const { duration, busy, now, limit = 6, perDay = 2 } = opts;
  const range = bookableRange(now);
  const from = Math.max(opts.from, range.start);
  const to = Math.min(opts.to, range.end);
  const out: number[] = [];
  // Walk ET days. Starting at noon UTC of each day keeps us safely inside the right ET date.
  const p0 = parts(from, ET);
  for (let day = Date.UTC(p0.y, p0.mo - 1, p0.d, 12); day <= to + DAY && out.length < limit; day += DAY) {
    const w = windowOn(day, CORE);
    if (!w) continue;
    let picked = 0;
    let last = -Infinity;
    for (let t = w.start; t + duration * MIN <= w.end && picked < perDay && out.length < limit; t += SLOT_STEP * MIN) {
      if (t < from || t > to || t - last < 3 * HOUR) continue;
      if (overlaps({ start: t, end: t + duration * MIN }, busy)) continue;
      out.push(t);
      last = t;
      picked++;
    }
  }
  return out;
}
