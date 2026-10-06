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
