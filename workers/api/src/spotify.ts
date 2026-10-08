/**
 * Spotify for Crate & Closet's request line and Crate Match: searching songs and artists, and
 * looking a song up by ID.
 *
 * Visitors never sign in to Spotify (a Development Mode app allows only five allowlisted users), so
 * these calls use the app's own client-credentials token, which works for catalogue lookups. Dan's
 * own listening (his top artists and tracks) uses his refresh token, as the stats refresh does.
 */
import type { Env } from "./env.ts";
import type { SearchArtist, SearchTrack } from "./types.ts";
import { HttpError } from "./twin.ts";

const ACCOUNTS = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

export const spotifyConfigured = (env: Env) => !!(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);

async function token(env: Env, body: Record<string, string>): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(ACCOUNTS, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`spotify token: HTTP ${res.status}`);
  return res.json();
}

/** The app's own token, reused across requests in this isolate until a minute before it expires. */
let app: { token: string; until: number } | null = null;
export async function appToken(env: Env): Promise<string> {
  if (app && Date.now() < app.until) return app.token;
  const t = await token(env, { grant_type: "client_credentials" });
  app = { token: t.access_token, until: Date.now() + (t.expires_in - 60) * 1000 };
  return app.token;
}

/** Dan's token (user-top-read), from the refresh token scripts/spotify-auth.mjs printed. */
export async function userToken(env: Env): Promise<string> {
  return (await token(env, { grant_type: "refresh_token", refresh_token: env.SPOTIFY_REFRESH_TOKEN! })).access_token;
}

export async function spotifyGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`spotify ${path.split("?")[0]}: HTTP ${res.status}`);
  return res.json<T>();
}

// Spotify omits fields such as `genres` and `images` for some apps and items, so every field is optional.
type Img = { url?: string }[];
export interface RawTrack {
  id?: string;
  name?: string;
  artists?: { name?: string }[];
  album?: { name?: string; images?: Img };
  external_urls?: { spotify?: string };
}
export interface RawArtist {
  id?: string;
  name?: string;
  genres?: string[];
  images?: Img;
  external_urls?: { spotify?: string };
}

/** The smallest image is plenty for a 48px sleeve; a middle one for a poster. */
const smallest = (images?: Img) => images?.at(-1)?.url ?? null;

export const toTrack = (t: RawTrack): SearchTrack | null =>
  t.id && t.name
    ? {
        id: t.id,
        name: t.name,
        artists: (t.artists ?? []).map((a) => a.name).filter(Boolean).join(", "),
        image: smallest(t.album?.images),
        url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
      }
    : null;

export const toArtist = (a: RawArtist): SearchArtist | null =>
  a.id && a.name ? { id: a.id, name: a.name, image: smallest(a.images), url: a.external_urls?.spotify ?? `https://open.spotify.com/artist/${a.id}` } : null;

export const SEARCH_LIMITS = { query: 80, results: 8 } as const;

/** `GET /api/spotify/search?type=track|artist&q=…` for the request line and Crate Match pickers. */
export async function handleSearch(request: Request, env: Env): Promise<{ tracks?: SearchTrack[]; artists?: SearchArtist[] }> {
  if (!spotifyConfigured(env)) throw new HttpError(503, "Search is switched off right now.");
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, SEARCH_LIMITS.query);
  if (type !== "track" && type !== "artist") throw new HttpError(400, "Search for a track or an artist.");
  if (q.length < 2) return type === "track" ? { tracks: [] } : { artists: [] };

  const { success } = await env.SEARCH_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "anon" });
  if (!success) throw new HttpError(429, "Slow down a little, the crates aren't going anywhere.");

  const params = new URLSearchParams({ q, type, limit: String(SEARCH_LIMITS.results) });
  const body = await spotifyGet<{ tracks?: { items: RawTrack[] }; artists?: { items: RawArtist[] } }>(await appToken(env), `/search?${params}`);
  return type === "track"
    ? { tracks: (body.tracks?.items ?? []).map(toTrack).filter((t) => t !== null) }
    : { artists: (body.artists?.items ?? []).map(toArtist).filter((a) => a !== null) };
}

/** One song by ID, so a request names what Spotify says, not what the browser sent. */
export async function getTrack(env: Env, id: string): Promise<SearchTrack | null> {
  if (!/^[A-Za-z0-9]{10,30}$/.test(id)) return null;
  try {
    return toTrack(await spotifyGet<RawTrack>(await appToken(env), `/tracks/${id}`));
  } catch {
    return null;
  }
}
