import type { FridgeStore } from "./fridge-store.ts";
import type { MancalaRecordStore } from "./mancala-store.ts";

export interface Env {
  ASSETS: Fetcher;
  STATS: KVNamespace;
  TWIN_LIMITER: RateLimit;
  /** The arcade robot's record (one SQLite-backed Durable Object). */
  MANCALA: DurableObjectNamespace<MancalaRecordStore>;
  MANCALA_LIMITER: RateLimit;
  /** Notes visitors pin on the fridge at Home (one SQLite-backed Durable Object). */
  FRIDGE: DurableObjectNamespace<FridgeStore>;
  FRIDGE_LIMITER: RateLimit;
  /** Emails Dan about new notes. Optional so the site still works before Email Sending is set up. */
  FRIDGE_MAIL?: SendEmail;

  SITE_URL: string;
  TWIN_MODEL: string;
  TWIN_MODEL_HIGH: string;
  /** Jev model (OpenRouter Decisions API) that sorts fridge notes. Defaults to "typesafe/jev-1.13". */
  FRIDGE_MODEL?: string;

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
}
