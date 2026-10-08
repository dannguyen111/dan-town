/**
 * Crate Match, at the record crates in Crate & Closet: how close a visitor's taste is to Dan's.
 *
 * Spotify has no public Blend or taste-match API, and visitors can't sign in to the app, so the
 * score is our own. A visitor picks a few artists (or gives a Last.fm username), and they're compared
 * with Dan's crate, his Spotify top artists, three ways:
 *  - shared artists count fully;
 *  - neighbours (Last.fm "similar artists", either way round) count by how similar they are;
 *  - the overall sound (Last.fm tags, weighted by how much each side listens) is compared as vectors.
 * Nothing about the visitor is stored. The crate itself is rebuilt once a day by the cron.
 */
import type { Env } from "./env.ts";
import type { MatchResult, SearchTrack } from "./types.ts";
import { HttpError } from "./twin.ts";
import { clientIp } from "./text.ts";
import { LastfmError, artistKey, artistProfile, lastfmConfigured, userTopArtists, type ArtistProfile } from "./lastfm.ts";
import { spotifyGet, toTrack, userToken, type RawArtist, type RawTrack } from "./spotify.ts";

const KEY = "crate:v1";
const ATTEMPT_KEY = "crate:attempt";
/** Dan's artists that get Last.fm profiles. Two Last.fm calls each, so this stays inside one cron run's subrequest budget. */
const CRATE_ARTISTS = 20;

export interface CrateArtist extends ArtistProfile {
  key: string;
  name: string;
  /** How much Dan listens to them, 0–1 (his #1 is 1). */
  weight: number;
}

export interface CrateTrack extends SearchTrack {
  artistKeys: string[];
}

export interface Crate {
  updatedAt: string;
  artists: CrateArtist[];
  tracks: CrateTrack[];
}

export const readCrate = (env: Env) => env.STATS.get<Crate>(KEY, "json");

/** Rank weight: the top of a chart counts more, but #20 still counts for something. */
export const rankWeight = (i: number) => 1 / (1 + i / 6);

/** Rebuild Dan's crate from his Spotify top artists and tracks (six months), with Last.fm profiles. */
export async function buildCrate(env: Env): Promise<Crate | null> {
  if (!lastfmConfigured(env) || !env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_REFRESH_TOKEN) return null;
  const token = await userToken(env);
  const [artists, tracks] = await Promise.all([
    spotifyGet<{ items: RawArtist[] }>(token, `/me/top/artists?time_range=medium_term&limit=${CRATE_ARTISTS}`),
    spotifyGet<{ items: RawTrack[] }>(token, "/me/top/tracks?time_range=medium_term&limit=50"),
  ]);
  const named = artists.items.filter((a) => a.name);
  const profiles = await Promise.all(named.map((a) => artistProfile(env, a.name!)));
  const crate: Crate = {
    updatedAt: new Date().toISOString(),
    artists: named.map((a, i) => ({ key: artistKey(a.name!), name: a.name!, weight: rankWeight(i), ...profiles[i]! })),
    tracks: tracks.items.flatMap((t) => {
      const track = toTrack(t);
      return track ? [{ ...track, artistKeys: (t.artists ?? []).flatMap((a) => (a.name ? [artistKey(a.name)] : [])) }] : [];
    }),
  };
  await env.STATS.put(KEY, JSON.stringify(crate));
  return crate;
}

// ───────────────────────────── scoring (pure) ─────────────────────────────

export interface VisitorArtist extends ArtistProfile {
  name: string;
  weight: number;
}

/** Scale a tag map so its biggest tag is 1. */
function unit(tags: Record<string, number>): Record<string, number> {
  const max = Math.max(0, ...Object.values(tags));
  return max ? Object.fromEntries(Object.entries(tags).map(([t, n]) => [t, n / max])) : {};
}

/** Everyone's tags added up, each artist counting by how much they're listened to. */
export function soundOf(artists: { weight: number; tags: Record<string, number> }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of artists) for (const [t, n] of Object.entries(unit(a.tags))) out[t] = (out[t] ?? 0) + a.weight * n;
  return out;
}

export function cosine(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  for (const [t, n] of Object.entries(a)) dot += n * (b[t] ?? 0);
  const norm = (v: Record<string, number>) => Math.sqrt(Object.values(v).reduce((s, n) => s + n * n, 0));
  const d = norm(a) * norm(b);
  return d ? dot / d : 0;
}

/** How similar two artists are by Last.fm, 0–1, looking both ways (it isn't always symmetric). */
const neighbourness = (v: VisitorArtist, d: CrateArtist) => Math.max(d.similar[artistKey(v.name)] ?? 0, v.similar[d.key] ?? 0);

/** A neighbour only counts above this Last.fm similarity. */
const NEIGHBOUR_AT = 0.15;

export const VERDICTS = [
  { at: 85, label: "Same crate" },
  { at: 65, label: "Neighbouring bins" },
  { at: 45, label: "Across the aisle" },
  { at: 25, label: "Different floors" },
  { at: 0, label: "Opposite ends of the shop" },
] as const;

export const verdictFor = (score: number) => VERDICTS.find((v) => score >= v.at)!.label;

export function scoreMatch(crate: Crate, visitor: VisitorArtist[]): Omit<MatchResult, "by"> {
  const shared: string[] = [];
  const neighbours: { yours: string; mine: string; similarity: number }[] = [];

  // Artists: how much of the visitor's listening lands in (or right next to) Dan's crate.
  let hit = 0;
  let total = 0;
  for (const v of visitor) {
    total += v.weight;
    const same = crate.artists.find((d) => d.key === artistKey(v.name));
    if (same) {
      shared.push(same.name);
      hit += v.weight;
      continue;
    }
    let best: { d: CrateArtist; m: number } | null = null;
    for (const d of crate.artists) {
      const m = neighbourness(v, d);
      if (m >= NEIGHBOUR_AT && (!best || m > best.m)) best = { d, m };
    }
    if (best) {
      neighbours.push({ yours: v.name, mine: best.d.name, similarity: Math.round(best.m * 100) / 100 });
      hit += v.weight * (0.45 + 0.4 * best.m);
    }
  }
  const artistsPart = total ? hit / total : 0;

  // Sound: the two sides' tag clouds.
  const theirs = soundOf(visitor);
  const mine = soundOf(crate.artists);
  const hasSound = Object.keys(theirs).length > 0 && Object.keys(mine).length > 0;
  const soundPart = hasSound ? cosine(theirs, mine) : 0;

  const raw = hasSound ? 0.55 * artistsPart + 0.45 * soundPart : artistsPart;
  // A gentle curve: overlapping tastes rarely share every artist, and the number should read that way.
  const score = raw >= 0.98 ? 100 : Math.max(1, Math.min(99, Math.round(100 * Math.pow(raw, 0.7))));

  const theirsUnit = unit(theirs);
  const mineUnit = unit(mine);
  const sharedTags = Object.keys(theirsUnit)
    .filter((t) => mineUnit[t])
    .sort((a, b) => Math.min(theirsUnit[b]!, mineUnit[b]!) - Math.min(theirsUnit[a]!, mineUnit[a]!))
    .slice(0, 4);

  return {
    score,
    verdict: verdictFor(score),
    shared,
    neighbours: neighbours.sort((a, b) => b.similarity - a.similarity).slice(0, 5),
    sharedTags,
    pick: pickRecord(crate, visitor, theirs),
  };
}

/**
 * One of Dan's records for the visitor. A neighbour is best (something new that should land), then
 * an artist whose sound matches theirs, then a shared favourite; otherwise his most-played track.
 */
export function pickRecord(crate: Crate, visitor: VisitorArtist[], theirSound: Record<string, number>): MatchResult["pick"] {
  const byKey = new Map(crate.artists.map((d) => [d.key, d]));
  const visitorKeys = new Map(visitor.map((v) => [artistKey(v.name), v]));
  let best: { track: CrateTrack; fit: number; why: string } | null = null;
  for (const [rank, track] of crate.tracks.entries()) {
    for (const k of track.artistKeys) {
      const d = byKey.get(k);
      if (!d) continue;
      let fit = 0;
      let why = "";
      const same = visitorKeys.get(k);
      if (same) {
        fit = 0.5;
        why = `You both have ${d.name} on repeat.`;
      }
      for (const v of visitor) {
        const m = neighbourness(v, d);
        if (m >= NEIGHBOUR_AT && 0.6 + 0.4 * m > fit) {
          fit = 0.6 + 0.4 * m;
          why = `Because you like ${v.name}.`;
        }
      }
      const sound = cosine(d.tags, theirSound) * 0.55;
      if (sound > fit) {
        fit = sound;
        const tag = Object.keys(unit(d.tags)).find((t) => theirSound[t]);
        why = tag ? `For your ${tag} side.` : "It sounds like your crate.";
      }
      // Earlier tracks (Dan plays them more) win ties.
      fit -= rank * 0.002;
      if (!best || fit > best.fit) best = { track, fit, why };
    }
  }
  const first = crate.tracks[0];
  if (best && best.fit > 0.05) return { ...strip(best.track), why: best.why };
  return first ? { ...strip(first), why: "The record Dan can't stop playing." } : null;
}

const strip = ({ artistKeys: _keys, ...track }: CrateTrack): SearchTrack => track;

// ───────────────────────────── handler ─────────────────────────────

export const MATCH_LIMITS = { minArtists: 1, maxArtists: 5, name: 100, lastfmArtists: 12 } as const;
const LASTFM_USER = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;

export function parseMatch(body: unknown): { artists: string[] } | { lastfm: string } {
  if (!body || typeof body !== "object") throw new HttpError(400, "Expected a JSON body.");
  const b = body as Record<string, unknown>;
  if (typeof b.lastfm === "string" && b.lastfm.trim()) {
    const user = b.lastfm.trim();
    if (!LASTFM_USER.test(user)) throw new HttpError(400, "That doesn't look like a Last.fm username.");
    return { lastfm: user };
  }
  if (!Array.isArray(b.artists)) throw new HttpError(400, "Pick a few artists first.");
  const names = [...new Set(b.artists.filter((a): a is string => typeof a === "string").map((a) => a.trim().slice(0, MATCH_LIMITS.name)).filter(Boolean))];
  if (names.length < MATCH_LIMITS.minArtists) throw new HttpError(400, "Pick a few artists first.");
  return { artists: names.slice(0, MATCH_LIMITS.maxArtists) };
}

/** `POST /api/match` with `{ artists: [names] }` or `{ lastfm: "username" }`. */
export async function handleMatch(request: Request, env: Env, ctx: ExecutionContext): Promise<MatchResult> {
  if (!lastfmConfigured(env)) throw new HttpError(503, "Crate Match isn't switched on yet.");
  const { success } = await env.MATCH_LIMITER.limit({ key: clientIp(request) });
  if (!success) throw new HttpError(429, "Easy, digger. Give the crates a minute.");

  const req = parseMatch(await request.json().catch(() => null));
  const crate = await readCrate(env);
  if (!crate?.artists.length) {
    // First match after a deploy: build the crate in the background, at most once per 10 minutes.
    if (!(await env.STATS.get(ATTEMPT_KEY))) {
      await env.STATS.put(ATTEMPT_KEY, "1", { expirationTtl: 600 });
      ctx.waitUntil(buildCrate(env).catch((err) => console.error("[crate] build failed:", err)));
    }
    throw new HttpError(503, "The crates are being restocked. Try again in a minute.");
  }

  let visitor: { name: string; weight: number }[];
  if ("lastfm" in req) {
    let top: { name: string; plays: number }[];
    try {
      top = (await userTopArtists(env, req.lastfm)).slice(0, MATCH_LIMITS.lastfmArtists);
    } catch (err) {
      if (err instanceof LastfmError && err.code === 6) throw new HttpError(404, "No Last.fm user by that name.");
      throw err;
    }
    if (!top.length) throw new HttpError(404, "That Last.fm account hasn't scrobbled anything in the last six months.");
    const most = top[0]!.plays || 1;
    visitor = top.map((a) => ({ name: a.name, weight: Math.max(0.1, a.plays / most) }));
  } else {
    visitor = req.artists.map((name) => ({ name, weight: 1 }));
  }

  const profiles = await Promise.all(visitor.map((v) => artistProfile(env, v.name)));
  const result = scoreMatch(
    crate,
    visitor.map((v, i) => ({ ...v, ...profiles[i]! })),
  );
  return { ...result, by: "lastfm" in req ? "lastfm" : "artists" };
}
