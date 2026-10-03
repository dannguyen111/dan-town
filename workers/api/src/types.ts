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
