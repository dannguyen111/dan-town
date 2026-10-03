import type { MancalaRecordStore } from "./mancala-store.ts";

export interface Env {
  ASSETS: Fetcher;
  STATS: KVNamespace;
  TWIN_LIMITER: RateLimit;
  /** The arcade robot's record (one SQLite-backed Durable Object). */
  MANCALA: DurableObjectNamespace<MancalaRecordStore>;
  MANCALA_LIMITER: RateLimit;

  SITE_URL: string;
  TWIN_MODEL: string;
  TWIN_MODEL_HIGH: string;

  // Secrets
  OPENROUTER_API_KEY?: string;
  GITHUB_TOKEN?: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  SPOTIFY_REFRESH_TOKEN?: string;
  TURNSTILE_SECRET?: string;
}
