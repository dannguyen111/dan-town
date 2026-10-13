/**
 * Small SVG building blocks for the README cards: documents with embedded pixel fonts, themed
 * cards, pixel-logo stack chips, and text wrapping.
 *
 * GitHub serves README images through its camo proxy as <img>, so an SVG can't load anything:
 * fonts are embedded as base64 data URIs, and every image is self-contained.
 *
 * Pure string building, no Node or DOM: shared with the Worker's live cards.
 */
import { logoRuns, LOGO_GRID, type PixelLogo } from "../../../apps/web/src/lib/stack-meta.ts";
import type { Theme } from "./theme.ts";

/** The site's fonts: Press Start 2P for labels, VT323 for body text, Pixelify Sans for names. */
export type FontKey = "retro" | "term" | "pixel";

/** Base64 woff2 per font. Pixelify Sans carries two weights. */
export type FontData = Record<FontKey, { family: string; faces: { weight: number; base64: string }[] }>;

export const FAMILY: Record<FontKey, string> = {
  retro: "'Press Start 2P', monospace",
  term: "VT323, monospace",
  pixel: "'Pixelify Sans', sans-serif",
};

/**
 * Advance width per character, in em. Press Start 2P and VT323 are monospaced (measured from the
 * fonts' hmtx tables); Pixelify Sans is proportional, so its value is a generous average.
 */
export const ADVANCE: Record<FontKey, number> = { retro: 1, term: 0.4, pixel: 0.62 };

export const textWidth = (text: string, font: FontKey, size: number) => [...text].length * ADVANCE[font] * size;

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Greedy word wrap to a pixel width. Over-long words are cut. */
export function wrap(text: string, font: FontKey, size: number, maxWidth: number): string[] {
  const max = Math.max(1, Math.floor(maxWidth / (ADVANCE[font] * size)));
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if ([...next].length <= max) line = next;
    else {
      if (line) lines.push(line);
      line = [...word].length > max ? [...word].slice(0, max - 1).join("") + "…" : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Cut text to fit a width, with an ellipsis. */
export function clip(text: string, font: FontKey, size: number, maxWidth: number): string {
  const max = Math.max(1, Math.floor(maxWidth / (ADVANCE[font] * size)));
  const chars = [...text];
  return chars.length <= max ? text : chars.slice(0, max - 1).join("").trimEnd() + "…";
}

export interface TextOpts {
  font: FontKey;
  size: number;
  fill: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  extra?: string;
}

export const text = (x: number, y: number, content: string, o: TextOpts) =>
  `<text x="${x}" y="${y}" font-family="${FAMILY[o.font]}" font-size="${o.size}"${o.weight ? ` font-weight="${o.weight}"` : ""}` +
  `${o.anchor && o.anchor !== "start" ? ` text-anchor="${o.anchor}"` : ""} fill="${o.fill}"${o.extra ? ` ${o.extra}` : ""}>${esc(content)}</text>`;

/** A block of lines; returns the markup and the y below the last line. */
export function lines(x: number, y: number, rows: string[], o: TextOpts & { lineHeight: number }) {
  const out = rows.map((r, i) => text(x, y + i * o.lineHeight, r, o)).join("");
  return { svg: out, bottom: y + (rows.length - 1) * o.lineHeight };
}

/** A whole SVG document, with only the fonts it uses embedded. */
export function doc(
  w: number,
  h: number,
  body: string,
  { fonts, data, title, css = "" }: { fonts: FontKey[]; data: FontData; title: string; css?: string },
): string {
  const faces = [...new Set(fonts)]
    .flatMap((k) =>
      data[k].faces.map(
        (f) =>
          `@font-face{font-family:'${data[k].family}';font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${f.base64}) format('woff2')}`,
      ),
    )
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">` +
    `<title>${esc(title)}</title><style>${faces}${css}</style>${body}</svg>`
  );
}

/** CRT scanlines, as a pattern any card can lay over itself. */
export const SCANLINES_DEF =
  `<defs><pattern id="scan" width="4" height="3" patternUnits="userSpaceOnUse">` +
  `<rect width="4" height="1" fill="#ffffff" opacity="0.035"/></pattern></defs>`;

export interface CardOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  theme: Theme;
  /** Which pushpin colour a light note gets. */
  pin?: number;
  /** Optional right-aligned tag in the label row (e.g. a status). */
  badge?: { text: string; fill: string };
}

/** Space a card's label row takes; content starts this far below the card's top. */
export const CARD_HEAD = 46;
export const CARD_PAD = 18;

/**
 * A pinned paper note (light) or a mission-control panel (dark), with its label.
 * Leaves 6px below and right for the hard shadow, so callers size the SVG as w + 6 by h + 6.
 */
export function card({ x, y, w, h, label, theme: t, pin = 0, badge }: CardOpts): string {
  const parts: string[] = [];
  if (t.mode === "light") {
    parts.push(`<rect x="${x + 5}" y="${y + 5}" width="${w}" height="${h}" fill="${t.shadow}"/>`);
    parts.push(`<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="${t.card}" stroke="${t.border}" stroke-width="2"/>`);
    const c = t.pins![pin % t.pins!.length]!;
    // A pushpin, drawn in pixels.
    parts.push(
      `<g shape-rendering="crispEdges"><rect x="${x + w / 2 - 6}" y="${y - 4}" width="12" height="12" fill="${t.border}"/>` +
        `<rect x="${x + w / 2 - 4}" y="${y - 2}" width="8" height="8" fill="${c}"/>` +
        `<rect x="${x + w / 2 - 2}" y="${y}" width="3" height="3" fill="#ffffff" opacity="0.8"/></g>`,
    );
  } else {
    parts.push(`<rect x="${x + 4}" y="${y + 4}" width="${w}" height="${h}" fill="${t.shadow}"/>`);
    parts.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" fill="${t.card}" stroke="${t.border}"/>`);
    if (t.scanlines) parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#scan)"/>`);
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="4" fill="${t.topBar}"/>`);
  }
  parts.push(text(x + CARD_PAD, y + 30, `${t.labelPrefix}${label}`.toUpperCase(), { font: "retro", size: 10, fill: t.label }));
  if (badge) {
    const bw = textWidth(badge.text, "retro", 8) + 16;
    const bx = x + w - CARD_PAD - bw;
    parts.push(
      `<rect x="${bx}" y="${y + 17}" width="${bw}" height="18" fill="none" stroke="${badge.fill}" stroke-width="2"/>` +
        text(bx + 8, y + 30, badge.text, { font: "retro", size: 8, fill: badge.fill }),
    );
  }
  return parts.join("");
}

/** A pixel logo on its tile, size×size. */
export function logo(l: PixelLogo, x: number, y: number, size: number): string {
  const s = size / LOGO_GRID;
  const runs = logoRuns(l.rows)
    .map((r) => `<rect x="${x + r.x * s}" y="${y + r.y * s}" width="${r.w * s}" height="${s}" fill="${r.white ? "#ffffff" : l.hex}"/>`)
    .join("");
  return `<g shape-rendering="crispEdges"><rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${l.tile}"/>${runs}</g>`;
}

export const CHIP_H = 30;

/** Width of a stack chip for this label. */
export const chipWidth = (label: string, size = 9) => 4 + 20 + 7 + textWidth(label, "retro", size) + 9;

/**
 * The site's StackChip: square, 2px outline, the logo on its tile, Press Start 2P label, and the
 * brand colour as a strip along the bottom.
 */
export function chip(label: string, l: PixelLogo, x: number, y: number, t: Theme, size = 9): { svg: string; w: number } {
  const w = chipWidth(label, size);
  const svg =
    `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${CHIP_H - 2}" fill="${t.chipBg}" stroke="${t.chipBorder}" stroke-width="2"/>` +
    `<rect x="${x + 2}" y="${y + CHIP_H - 5}" width="${w - 4}" height="3" fill="${l.hex}"/>` +
    logo(l, x + 4, y + 4, 20) +
    text(x + 31, y + 18, label, { font: "retro", size, fill: t.text });
  return { svg, w };
}

/** Lay chips out left to right, wrapping at maxWidth. Returns the markup and the bottom edge. */
export function chipFlow(
  items: { label: string; logo: PixelLogo }[],
  x: number,
  y: number,
  maxWidth: number,
  t: Theme,
  gap = 8,
): { svg: string; bottom: number } {
  let cx = x;
  let cy = y;
  const out: string[] = [];
  for (const it of items) {
    const w = chipWidth(it.label);
    if (cx > x && cx + w > x + maxWidth) {
      cx = x;
      cy += CHIP_H + gap;
    }
    out.push(chip(it.label, it.logo, cx, cy, t).svg);
    cx += w + gap;
  }
  return { svg: out.join(""), bottom: items.length ? cy + CHIP_H : y };
}
