/**
 * The time of day in Dan's time zone (US Eastern), shared by the town and every interior so they all
 * agree on whether it's night. `?time=21:30` in the URL forces the clock, for trying out each sky.
 */

const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" });

/** A `time=HH:MM` (24-hour) query parameter, or null if it's missing or not a real time. */
export function parseTimeParam(search: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(search).get("time") ?? "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? { h, m } : null;
}

const forced = typeof location === "undefined" ? null : parseTimeParam(location.search);

/**
 * Hours (0–23) and minutes in Dan's time zone, whatever the visitor's own clock says. Without `now`,
 * a `?time=` override wins over the real clock.
 */
export function easternTime(now?: Date) {
  if (!now && forced) return { ...forced };
  const parts = ET.formatToParts(now ?? new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { h: get("hour") % 24, m: get("minute") };
}

/** e.g. "7:42 PM". */
export function formatEastern(now?: Date) {
  const { h, m } = easternTime(now);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export type Sky = "night" | "dawn" | "day" | "dusk";
/** The sky at `t` hours past midnight (fractional), Eastern. */
export const skyAt = (t: number): Sky => (t < 5 || t >= 20 ? "night" : t < 7 ? "dawn" : t < 17 ? "day" : "dusk");

/** The sky in Dan's time zone right now (or at `now`). */
export function skyNow(now?: Date): Sky {
  const { h, m } = easternTime(now);
  return skyAt(h + m / 60);
}

/**
 * The wash laid over the town's art for each sky, beneath the characters so they stay readable. Name
 * tags and speech bubbles are HTML above the canvas, so their contrast never changes.
 */
export const TOWN_TINT: Record<Sky, string | null> = {
  night: "rgba(18, 26, 74, 0.38)",
  dawn: "rgba(255, 160, 120, 0.14)",
  day: null,
  dusk: "rgba(255, 120, 60, 0.18)",
};
