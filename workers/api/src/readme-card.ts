/**
 * GET /api/readme/on-repeat.svg?theme=light|dark — Dan's Spotify top tracks as a README card, in
 * the same town / mission-control look as the generated ones (packages/readme). Live, from the
 * stats the daily cron already stores; album art is inlined because GitHub's image proxy won't
 * let an SVG load anything.
 */
import { card, CARD_HEAD, CARD_PAD, clip, doc, SCANLINES_DEF, text, type FontData } from "../../../packages/readme/src/svg.ts";
import { THEMES, type Mode } from "../../../packages/readme/src/theme.ts";
import type { Env } from "./env.ts";
import { README_FONTS } from "./generated/readme-fonts.ts";
import { readStats } from "./stats.ts";
import type { SpotifyStats } from "./types.ts";

const W = 830;
const SHOWN = 5;
const ROW = 54;
const ART = 40;

/** Album art as data URIs, by image URL. */
export type ArtMap = Record<string, string>;

export function renderOnRepeat(spotify: SpotifyStats | null, mode: Mode, fonts: FontData, art: ArtMap = {}): string {
  const t = THEMES[mode];
  const tracks = spotify?.topTracks.slice(0, SHOWN) ?? [];
  const w = W - 6;
  const parts: string[] = [];
  let y = CARD_HEAD + 6;
  if (!tracks.length) {
    parts.push(text(CARD_PAD, y + 14, "📻 The radio's quiet right now.", { font: "term", size: 20, fill: t.soft }));
    y += 34;
  }
  tracks.forEach((tr, i) => {
    const x = CARD_PAD;
    parts.push(text(x, y + 26, String(i + 1).padStart(2, "0"), { font: "retro", size: 12, fill: t.accent }));
    const ax = x + 40;
    const src = tr.image ? art[tr.image] : undefined;
    parts.push(
      src
        ? `<image href="${src}" x="${ax}" y="${y}" width="${ART}" height="${ART}" style="image-rendering:pixelated"/>`
        : `<rect x="${ax}" y="${y}" width="${ART}" height="${ART}" fill="${t.chipBg}" stroke="${t.chipBorder}"/>` +
            text(ax + ART / 2, y + 27, "♪", { font: "term", size: 22, fill: t.soft, anchor: "middle" }),
    );
    parts.push(`<rect x="${ax}" y="${y}" width="${ART}" height="${ART}" fill="none" stroke="${t.border}" stroke-width="2"/>`);
    const tx = ax + ART + 14;
    const room = w - tx - CARD_PAD;
    parts.push(text(tx, y + 17, clip(tr.name, "term", 22, room), { font: "term", size: 22, fill: t.text }));
    parts.push(text(tx, y + 37, clip(tr.artists, "term", 18, room), { font: "term", size: 18, fill: t.soft }));
    y += ROW;
  });
  const genres = spotify?.topGenres.slice(0, 4) ?? [];
  if (genres.length) {
    parts.push(text(CARD_PAD, y + 12, clip(`▸ lately: ${genres.join(" · ")}`, "term", 18, w - CARD_PAD * 2), { font: "term", size: 18, fill: t.link }));
    y += 30;
  }
  const h = y + 4;
  const body =
    (t.scanlines ? SCANLINES_DEF : "") +
    card({ x: 0, y: 6, w, h, label: "On repeat", theme: t, pin: 1, badge: { text: "LIVE", fill: t.ok } }) +
    `<g transform="translate(0 6)">${parts.join("")}</g>`;
  return doc(W, h + 12, body, {
    fonts: ["retro", "term"],
    data: fonts,
    title: tracks.length ? `On repeat: ${tracks.map((x) => `${x.name} by ${x.artists}`).join("; ")}` : "On repeat",
  });
}

/** Fetch each track's (small) album cover as a data URI. Failures just leave a placeholder. */
async function fetchArt(spotify: SpotifyStats | null): Promise<ArtMap> {
  const urls = (spotify?.topTracks.slice(0, SHOWN) ?? []).map((t) => t.image).filter((u): u is string => !!u && u.startsWith("https://"));
  const entries = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) return null;
        const type = res.headers.get("Content-Type") ?? "image/jpeg";
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length > 64_000) return null;
        let bin = "";
        for (const b of bytes) bin += String.fromCharCode(b);
        return [url, `data:${type};base64,${btoa(bin)}`] as const;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((e) => e !== null));
}

export async function handleOnRepeatCard(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const mode: Mode = new URL(request.url).searchParams.get("theme") === "dark" ? "dark" : "light";
  const spotify = (await readStats(env))?.spotify ?? null;
  const svg = renderOnRepeat(spotify, mode, README_FONTS, await fetchArt(spotify));
  const res = new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Top tracks change once a day; GitHub's proxy and the edge may keep this for 30 minutes.
      "Cache-Control": "public, max-age=1800",
    },
  });
  ctx.waitUntil(cache.put(request, res.clone()));
  return res;
}
