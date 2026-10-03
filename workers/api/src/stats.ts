import type { Env } from "./env.ts";
import type { GitHubStats, LeetCodeStats, SpotifyStats, Stats } from "./types.ts";
import { INTEGRATIONS } from "./generated/twin-context.ts";

const KEY = "stats:v1";
const ATTEMPT_KEY = "stats:attempt";
const UA = "dan-town-stats (+https://github.com/dannguyen111)";

export const EMPTY_STATS: Stats = { updatedAt: null, github: null, leetcode: null, spotify: null };

export async function readStats(env: Env): Promise<Stats | null> {
  return env.STATS.get<Stats>(KEY, "json");
}

/** Fetch every integration. A failing source keeps its previous value instead of blanking the page. */
export async function refreshStats(env: Env): Promise<Stats> {
  const prev = (await readStats(env)) ?? EMPTY_STATS;
  const [github, leetcode, spotify] = await Promise.all([
    settle("github", fetchGitHub(env), prev.github),
    settle("leetcode", fetchLeetCode(), prev.leetcode),
    settle("spotify", fetchSpotify(env), prev.spotify),
  ]);
  const next: Stats = { updatedAt: new Date().toISOString(), github, leetcode, spotify };
  await env.STATS.put(KEY, JSON.stringify(next));
  return next;
}

/** First request after a deploy: kick off a background refresh, at most once per 10 minutes. */
export async function refreshIfEmpty(env: Env, ctx: ExecutionContext) {
  if (await env.STATS.get(ATTEMPT_KEY)) return;
  await env.STATS.put(ATTEMPT_KEY, "1", { expirationTtl: 600 });
  ctx.waitUntil(refreshStats(env));
}

async function settle<T>(name: string, p: Promise<T | null>, fallback: T | null): Promise<T | null> {
  try {
    return (await p) ?? fallback;
  } catch (err) {
    console.warn(`[stats] ${name} refresh failed:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

async function json<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return res.json<T>();
}

// ───────────────────────────── GitHub (GraphQL, needs a read-only token) ─────────────────────────────

const LEVELS: Record<string, number> = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function fetchGitHub(env: Env): Promise<GitHubStats | null> {
  const login = INTEGRATIONS.github.username;
  if (!login || !env.GITHUB_TOKEN) return null;
  const query = `query($login: String!) {
    user(login: $login) {
      login url followers { totalCount }
      repositories(privacy: PUBLIC, ownerAffiliations: OWNER, isFork: false, first: 6, orderBy: { field: PUSHED_AT, direction: DESC }) {
        totalCount
        nodes { name description url stargazerCount primaryLanguage { name } pushedAt }
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount contributionLevel } }
        }
      }
    }
  }`;
  type R = {
    data?: {
      user: {
        login: string;
        url: string;
        followers: { totalCount: number };
        repositories: {
          totalCount: number;
          nodes: { name: string; description: string | null; url: string; stargazerCount: number; primaryLanguage: { name: string } | null; pushedAt: string }[];
        };
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: number;
            weeks: { contributionDays: { date: string; contributionCount: number; contributionLevel: string }[] }[];
          };
        };
      } | null;
    };
    errors?: { message: string }[];
  };
  const body = await json<R>(
    await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ query, variables: { login } }),
    }),
    "github",
  );
  const u = body.data?.user;
  if (!u) throw new Error(`github: ${body.errors?.[0]?.message ?? "user not found"}`);
  const cal = u.contributionsCollection.contributionCalendar;
  return {
    login: u.login,
    url: u.url,
    publicRepos: u.repositories.totalCount,
    followers: u.followers.totalCount,
    totalContributions: cal.totalContributions,
    calendar: cal.weeks.flatMap((w) =>
      w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0 })),
    ),
    repos: u.repositories.nodes.map((r) => ({
      name: r.name,
      description: r.description,
      url: r.url,
      stars: r.stargazerCount,
      language: r.primaryLanguage?.name ?? null,
      pushedAt: r.pushedAt,
    })),
  };
}

// ───────────────────────────── LeetCode (public, unofficial GraphQL) ─────────────────────────────

async function fetchLeetCode(): Promise<LeetCodeStats | null> {
  const username = INTEGRATIONS.leetcode.username;
  if (!username) return null;
  const query = `query($username: String!) {
    matchedUser(username: $username) {
      username
      profile { ranking }
      submitStatsGlobal { acSubmissionNum { difficulty count } }
    }
    allQuestionsCount { difficulty count }
  }`;
  type Count = { difficulty: string; count: number };
  type R = {
    data?: {
      matchedUser: { username: string; profile: { ranking: number | null }; submitStatsGlobal: { acSubmissionNum: Count[] } } | null;
      allQuestionsCount: Count[];
    };
  };
  const body = await json<R>(
    await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://leetcode.com", "User-Agent": UA },
      body: JSON.stringify({ query, variables: { username } }),
    }),
    "leetcode",
  );
  const user = body.data?.matchedUser;
  if (!user) throw new Error("leetcode: user not found or endpoint changed");
  const pick = (rows: Count[]) => {
    const get = (d: string) => rows.find((r) => r.difficulty.toLowerCase() === d)?.count ?? 0;
    return { all: get("all"), easy: get("easy"), medium: get("medium"), hard: get("hard") };
  };
  return {
    username: user.username,
    url: `https://leetcode.com/u/${user.username}/`,
    solved: pick(user.submitStatsGlobal.acSubmissionNum),
    totals: pick(body.data!.allQuestionsCount),
    ranking: user.profile.ranking,
  };
}

// ───────────────────────────── Spotify (refresh-token flow, user-top-read) ─────────────────────────────

async function fetchSpotify(env: Env): Promise<SpotifyStats | null> {
  if (!INTEGRATIONS.spotify.enabled || !env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_REFRESH_TOKEN) return null;
  const token = await json<{ access_token: string }>(
    await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: env.SPOTIFY_REFRESH_TOKEN }),
    }),
    "spotify token",
  );
  const get = <T>(path: string) =>
    fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${token.access_token}` } }).then((r) => json<T>(r, `spotify ${path}`));

  type Img = { url: string }[];
  const [tracks, artists] = await Promise.all([
    get<{ items: { name: string; artists: { name: string }[]; album: { name: string; images: Img }; external_urls: { spotify: string } }[] }>(
      "/me/top/tracks?time_range=short_term&limit=10",
    ),
    get<{ items: { name: string; genres: string[]; images: Img; external_urls: { spotify: string } }[] }>("/me/top/artists?time_range=medium_term&limit=10"),
  ]);

  const genreCounts = new Map<string, number>();
  for (const a of artists.items) for (const g of a.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);

  return {
    topTracks: tracks.items.map((t) => ({
      name: t.name,
      artists: t.artists.map((a) => a.name).join(", "),
      album: t.album.name,
      image: t.album.images.at(-1)?.url ?? null,
      url: t.external_urls.spotify,
    })),
    topArtists: artists.items.map((a) => ({
      name: a.name,
      genres: a.genres.slice(0, 3),
      image: a.images.at(-1)?.url ?? null,
      url: a.external_urls.spotify,
    })),
    topGenres: [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g),
  };
}
