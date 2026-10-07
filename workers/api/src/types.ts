/** Shape of `GET /api/stats`. Shared with the website (import from "@dan-town/api/types"). */
export interface Stats {
  updatedAt: string | null;
  github: GitHubStats | null;
  leetcode: LeetCodeStats | null;
  spotify: SpotifyStats | null;
}

export interface GitHubStats {
  login: string;
  url: string;
  publicRepos: number;
  followers: number;
  totalContributions: number;
  /** One entry per day for the last year, oldest first. level is 0–4. */
  calendar: { date: string; count: number; level: number }[];
  repos: { name: string; description: string | null; url: string; stars: number; language: string | null; pushedAt: string }[];
}

export interface LeetCodeStats {
  username: string;
  url: string;
  solved: Record<"all" | "easy" | "medium" | "hard", number>;
  totals: Record<"all" | "easy" | "medium" | "hard", number>;
  ranking: number | null;
}

export interface SpotifyStats {
  topTracks: { name: string; artists: string; album: string; image: string | null; url: string }[];
  topArtists: { name: string; genres: string[]; image: string | null; url: string }[];
  /** Most common genres across top artists, for a quick "taste" summary. */
  topGenres: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** A meeting time the twin offers, shown as a button in the chat. */
export interface Slot {
  /** ISO 8601, UTC. */
  start: string;
  duration: 15 | 30;
  /** e.g. "Tue, Oct 7, 2:00 PM EDT" */
  et: string;
  /** The same instant in the visitor's time zone. */
  local: string;
  /** Outside Dan's usual hours (a time the visitor proposed). */
  custom?: boolean;
}

/** One line of the NDJSON stream `POST /api/twin` returns. `run` carries the id of this reply's trace. */
export type TwinEvent = { t: "text"; v: string } | { t: "slots"; v: Slot[] } | { t: "error"; v: string } | { t: "run"; v: string };

/** One tool call inside a round. `t0` is ms since the run started. Arguments are never kept. */
export interface TraceTool {
  name: string;
  t0: number;
  ms: number;
  ok: boolean;
}

/** One model completion. Token counts are null when the provider didn't report usage. */
export interface TraceRound {
  t0: number;
  ms: number;
  /** Time to the first streamed token, or null when nothing streamed. */
  ttftMs: number | null;
  in: number | null;
  cached: number | null;
  out: number | null;
  tools: TraceTool[];
}

/**
 * How one twin reply was produced, for the computer's trace viewer. Only timings, token counts and
 * tool names: never the visitor's words, the reply, tool arguments or anything about the visitor.
 */
export interface Trace {
  id: string;
  /** ISO time the run started. */
  at: string;
  model: string;
  totalMs: number;
  ok: boolean;
  /** USD, as reported by OpenRouter. Null when not reported. */
  cost: number | null;
  rounds: TraceRound[];
}

export interface TraceSummary {
  runs24h: number;
  p50Ms: number | null;
  p95Ms: number | null;
  /** Share of prompt tokens served from the provider's cache, 0–1. Null without usage data. */
  cacheHit: number | null;
  /** Average USD per reply. Null without cost data. */
  avgCost: number | null;
  /** How often each tool was called across the kept traces. */
  tools: Record<string, number>;
}

/** Shape of `GET /api/traces`. Newest first. */
export interface TracesResponse {
  summary: TraceSummary;
  traces: Trace[];
}

/** Body of `POST /api/twin/book`. */
export interface BookingRequestBody {
  start: string;
  duration: 15 | 30;
  name: string;
  email: string;
  topic: string;
  tz: string;
  website: string;
  turnstileToken?: string;
}

/** Shape of `GET /api/mancala`: the arcade robot's record against everyone, from the robot's side. */
export type MancalaLevel = "easy" | "medium" | "hard";
export interface MancalaLevelRecord {
  played: number;
  won: number;
  lost: number;
  draw: number;
}
export type MancalaRecord = Record<MancalaLevel, MancalaLevelRecord>;

/** Body of `POST /api/mancala`: a finished game's level and final store counts. */
export interface MancalaResult {
  level: MancalaLevel;
  robot: number;
  human: number;
}

/** Why a visitor left a note on the fridge, as sorted by Jev. "unsorted" when the classifier was unavailable. */
export type FridgeTopic = "hiring" | "collab" | "hi" | "unsorted";

/** A note pinned on the fridge, as `GET /api/fridge` shows it. Contact details are never public. */
export interface FridgeNote {
  id: string;
  name: string;
  message: string;
  topic: FridgeTopic;
  /** ISO time the note was left. */
  at: string;
}

/** Body of `POST /api/fridge`. `website` is a honeypot: people never see it, bots fill it in. */
export interface FridgeNoteRequest {
  message: string;
  name?: string;
  contact?: string;
  website?: string;
  turnstileToken?: string;
}
