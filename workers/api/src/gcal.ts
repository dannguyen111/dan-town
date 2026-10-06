/**
 * The slice of Google Calendar the twin needs: free/busy (never event titles or details) and,
 * only after Dan approves a request, creating the event with a Google Meet link.
 *
 * Auth is Dan's own OAuth refresh token (scripts/google-auth.mjs), with scopes
 * calendar.freebusy + calendar.events. Keep the Google Cloud OAuth app "In production": in
 * "Testing" mode Google expires refresh tokens after 7 days.
 */
import type { Env } from "./env.ts";
import type { Interval } from "./schedule.ts";

const API = "https://www.googleapis.com/calendar/v3";

export class CalendarError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export const calendarConfigured = (env: Env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
const calendarId = (env: Env) => env.GOOGLE_CALENDAR_ID || "primary";

// Access tokens last an hour; reuse one per isolate until a minute before it expires.
let cached: { token: string; until: number } | null = null;
export const resetTokenCache = () => void (cached = null);

export async function getAccessToken(env: Env): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  if (!calendarConfigured(env)) throw new CalendarError(503, "Google Calendar is not configured.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.GOOGLE_REFRESH_TOKEN!,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new CalendarError(res.status, `Google token refresh failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const out = await res.json<{ access_token: string; expires_in: number }>();
  cached = { token: out.access_token, until: Date.now() + (out.expires_in - 60) * 1000 };
  return out.access_token;
}

async function call<T>(env: Env, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getAccessToken(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new CalendarError(res.status, `Google Calendar ${path.split("?")[0]} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.json<T>();
}

/** Busy intervals on Dan's calendar between `from` and `to` (epoch ms). */
export async function freeBusy(env: Env, from: number, to: number): Promise<Interval[]> {
  const id = calendarId(env);
  const out = await call<{ calendars: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> }>(env, "/freeBusy", {
    timeMin: new Date(from).toISOString(),
    timeMax: new Date(to).toISOString(),
    items: [{ id }],
  });
  const cal = out.calendars?.[id];
  if (!cal || cal.errors?.length) throw new CalendarError(502, `Google free/busy returned errors for the calendar: ${JSON.stringify(cal?.errors ?? "missing")}`);
  return (cal.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

export interface NewEvent {
  /** Reused as the Meet createRequest id, so a retried approval can't make two Meet rooms. */
  requestId: string;
  start: number;
  end: number;
  summary: string;
  description: string;
  attendee: { email: string; name: string };
}

export interface CreatedEvent {
  id: string;
  htmlLink: string;
  hangoutLink?: string;
}

/** Creates the event with a Google Meet link and has Google email the invite to the visitor. */
export async function createEvent(env: Env, e: NewEvent): Promise<CreatedEvent> {
  const path = `/calendars/${encodeURIComponent(calendarId(env))}/events?conferenceDataVersion=1&sendUpdates=all`;
  return call<CreatedEvent>(env, path, {
    summary: e.summary,
    description: e.description,
    start: { dateTime: new Date(e.start).toISOString() },
    end: { dateTime: new Date(e.end).toISOString() },
    attendees: [{ email: e.attendee.email, displayName: e.attendee.name }],
    conferenceData: { createRequest: { requestId: e.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    guestsCanSeeOtherGuests: false,
  });
}
