/**
 * Last.fm for Crate Match: what an artist sounds like (their crowd-sourced tags) and who they sound
 * like (similar artists), plus a Last.fm user's public top artists. Only an API key is needed, never
 * a visitor's login. Spotify no longer offers related artists, and its genres are often missing.
 * Docs: https://www.last.fm/api
 */
import type { Env } from "./env.ts";

const API = "https://ws.audioscrobbler.com/2.0/";
/** Artist tags and neighbours barely change, so each artist is looked up at most once a month. */
const ARTIST_TTL = 30 * 86_400;

export const lastfmConfigured = (env: Env) => !!env.LASTFM_API_KEY;

export class LastfmError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

async function call<T>(env: Env, method: string, params: Record<string, string>): Promise<T> {
  const url = new URL(API);
  url.search = new URLSearchParams({ method, api_key: env.LASTFM_API_KEY!, format: "json", ...params }).toString();
  const res = await fetch(url, { headers: { "User-Agent": "dan-town (+https://si-dan.com)" } });
  const body = await res.json<T & { error?: number; message?: string }>().catch(() => null);
  // Last.fm reports errors (unknown user, no such artist) in the body, often with HTTP 200.
  if (!body || body.error) throw new LastfmError(body?.error ?? res.status, body?.message ?? `last.fm ${method}: HTTP ${res.status}`);
  return body;
}

/** Lowercase, no accents, "&" as "and", no leading "the": "The Weeknd" and "the weeknd" are one artist. */
export const artistKey = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export interface ArtistProfile {
  /** Tag → weight 0–100 (Last.fm's count), e.g. { "neo-soul": 100, "r&b": 84 }. */
  tags: Record<string, number>;
  /** Neighbour's artistKey → how similar, 0–1. */
  similar: Record<string, number>;
}

/** Tags people use for everything, which say nothing about how an artist sounds. */
const NOISE = new Set(["seen live", "favorites", "favourite", "favorite", "favourites", "love", "awesome", "beautiful", "albums i own", "my top artists", "spotify"]);

export function parseTags(body: { toptags?: { tag?: { name?: string; count?: number | string }[] } }, keep = 8): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of body.toptags?.tag ?? []) {
    const name = t.name?.toLowerCase().trim();
    const count = Number(t.count ?? 0);
    if (!name || NOISE.has(name) || count <= 0) continue;
    out[name] = count;
    if (Object.keys(out).length >= keep) break;
  }
  return out;
}

export function parseSimilar(body: { similarartists?: { artist?: { name?: string; match?: number | string }[] } }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of body.similarartists?.artist ?? []) {
    const match = Number(a.match ?? 0);
    if (a.name && match > 0) out[artistKey(a.name)] = Math.min(1, match);
  }
  return out;
}

/** An artist's tags and neighbours, from the KV cache or Last.fm. An unknown artist is an empty profile. */
export async function artistProfile(env: Env, name: string): Promise<ArtistProfile> {
  const cacheKey = `lastfm:artist:${artistKey(name)}`;
  const cached = await env.STATS.get<ArtistProfile>(cacheKey, "json");
  if (cached) return cached;
  const [tags, similar] = await Promise.all([
    call<Parameters<typeof parseTags>[0]>(env, "artist.gettoptags", { artist: name, autocorrect: "1" }).then((b) => parseTags(b), (): Record<string, number> => ({})),
    call<Parameters<typeof parseSimilar>[0]>(env, "artist.getsimilar", { artist: name, autocorrect: "1", limit: "40" }).then(parseSimilar, (): Record<string, number> => ({})),
  ]);
  const profile = { tags, similar };
  await env.STATS.put(cacheKey, JSON.stringify(profile), { expirationTtl: ARTIST_TTL });
  return profile;
}

/** A Last.fm user's most-played artists over the last six months, with their play counts. */
export async function userTopArtists(env: Env, user: string, limit = 25): Promise<{ name: string; plays: number }[]> {
  const body = await call<{ topartists?: { artist?: { name?: string; playcount?: string | number }[] } }>(env, "user.gettopartists", {
    user,
    period: "6month",
    limit: String(limit),
  });
  return (body.topartists?.artist ?? []).filter((a) => a.name).map((a) => ({ name: a.name!, plays: Number(a.playcount ?? 0) }));
}
