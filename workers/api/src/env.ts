import type { FridgeStore } from "./fridge-store.ts";
import type { MancalaRecordStore } from "./mancala-store.ts";
import type { BookingStore } from "./booking-store.ts";
import type { TraceStore } from "./trace-store.ts";

export interface Env {
  ASSETS: Fetcher;
  STATS: KVNamespace;
  TWIN_LIMITER: RateLimit;
  /** Per-sentence text-to-speech calls for the twin's voice. */
  SPEAK_LIMITER: RateLimit;
  /** The arcade robot's record (one SQLite-backed Durable Object). */
  MANCALA: DurableObjectNamespace<MancalaRecordStore>;
  MANCALA_LIMITER: RateLimit;
  /** Notes visitors pin on the fridge at Home (one SQLite-backed Durable Object). */
  FRIDGE: DurableObjectNamespace<FridgeStore>;
  FRIDGE_LIMITER: RateLimit;
  /** Meeting requests visitors send from the twin chat (one SQLite-backed Durable Object). */
  BOOKING: DurableObjectNamespace<BookingStore>;
  /** The twin's recent run traces, shown on the computer at Home (one SQLite-backed Durable Object). */
  TRACES: DurableObjectNamespace<TraceStore>;
  /** Emails Dan about new notes. Optional so the site still works before Email Sending is set up. */
  FRIDGE_MAIL?: SendEmail;

  SITE_URL: string;
  TWIN_MODEL: string;
  /** OpenRouter speech model for the twin's voice (e.g. "hexgrad/kokoro-82m"). Empty turns the voice off. */
  TTS_MODEL?: string;
  /** Voice ID for TTS_MODEL. Defaults to "am_michael". */
  TTS_VOICE?: string;
  /** LeBronette's voice ID for TTS_MODEL. Defaults to "af_heart". */
  TTS_VOICE_RECEPTIONIST?: string;
  /** Jev model (OpenRouter Decisions API) that sorts fridge notes. Defaults to "typesafe/jev-1.13". */
  FRIDGE_MODEL?: string;
  /** Google Calendar the twin reads free/busy from and books into. Defaults to "primary". */
  GOOGLE_CALENDAR_ID?: string;

  // Secrets
  OPENROUTER_API_KEY?: string;
  GITHUB_TOKEN?: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  SPOTIFY_REFRESH_TOKEN?: string;
  TURNSTILE_SECRET?: string;
  /** Signs the approve/reject links in fridge emails. Any long random string. */
  FRIDGE_SECRET?: string;
  /** Where fridge emails go: a verified destination address in Email Routing. Kept out of the repo. */
  FRIDGE_NOTIFY_TO?: string;
  /** Dan's Google OAuth client and refresh token (scripts/google-auth.mjs). All three turn on meeting requests. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  /** Signs the approve/decline links in meeting-request emails. Any long random string. */
  BOOKING_SECRET?: string;
}
