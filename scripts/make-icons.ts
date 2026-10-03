/**
 * Generates the site icons from the twin's in-town sprite (with headphones), on a grass tile
 * like the town's. Run after changing the sprite:  npm run icons:build
 *
 * Writes apps/web/public/favicon.svg (crisp at any size), favicon.png (64px) and
 * apple-touch-icon.png (180px, full-bleed because iOS rounds the corners itself).
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { cellColour, compose, TWIN_PALETTE } from "../apps/web/src/town/sprites.ts";

const SIZE = 16;
const INK = "#3b2a2a";
const GRASS = "#9bd770";
const GRASS_DARK = "#86c75e";
const GRASS_LIGHT = "#b6e88b";
const OUT = new URL("../apps/web/public/", import.meta.url);

type Grid = (string | null)[][];

function iconGrid(framed: boolean): Grid {
  const g: Grid = Array.from({ length: SIZE }, () => Array<string | null>(SIZE).fill(GRASS));
  // A few grass blades, as on the town's grass tiles.
  for (const [x, y, c] of [[3, 13, GRASS_DARK], [12, 12, GRASS_LIGHT], [2, 6, GRASS_LIGHT], [13, 4, GRASS_DARK], [4, 2, GRASS_DARK]] as const) {
    g[y]![x] = c;
    g[y + 1]![x] = c;
  }
  // Head and shoulders: the first 13 sprite rows, cropped by the bottom edge like a portrait.
  const rows = compose("down", 0, true).slice(0, 13);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const c = cellColour(TWIN_PALETTE, ch, y);
    if (c && y + 2 < SIZE) g[y + 2]![x + 2] = c;
  }));
  if (framed) {
    // Ink border with rounded corners, matching the town's labels and bubbles.
    for (let i = 0; i < SIZE; i++) for (const [x, y] of [[i, 0], [i, SIZE - 1], [0, i], [SIZE - 1, i]] as const) g[y]![x] = INK;
    for (const [x, y] of [[0, 0], [SIZE - 1, 0], [0, SIZE - 1], [SIZE - 1, SIZE - 1]] as const) g[y]![x] = null;
    for (const [x, y] of [[1, 1], [SIZE - 2, 1], [1, SIZE - 2], [SIZE - 2, SIZE - 2]] as const) g[y]![x] = INK;
  }
  return g;
}

function svg(g: Grid): string {
  const rects = g.flatMap((row, y) => row.map((c, x) => (c ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>` : ""))).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges">${rects}</svg>\n`;
}

// ── Minimal PNG encoder (RGBA, nearest-neighbour upscaling) ──
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(g: Grid, px: number, pad = 0): Buffer {
  const scale = Math.floor((px - pad * 2) / SIZE);
  const offset = Math.floor((px - scale * SIZE) / 2);
  const bg = g[Math.floor(SIZE / 2)]![1] ?? GRASS; // fill any padding with grass
  const raw = Buffer.alloc(px * (px * 4 + 1));
  for (let y = 0; y < px; y++) {
    raw[y * (px * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < px; x++) {
      const gx = Math.floor((x - offset) / scale);
      const gy = Math.floor((y - offset) / scale);
      const inside = gx >= 0 && gy >= 0 && gx < SIZE && gy < SIZE;
      const c = inside ? g[gy]![gx] : bg;
      const i = y * (px * 4 + 1) + 1 + x * 4;
      if (!c) continue; // transparent
      raw[i] = parseInt(c.slice(1, 3), 16);
      raw[i + 1] = parseInt(c.slice(3, 5), 16);
      raw[i + 2] = parseInt(c.slice(5, 7), 16);
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const framed = iconGrid(true);
writeFileSync(new URL("favicon.svg", OUT), svg(framed));
writeFileSync(new URL("favicon.png", OUT), png(framed, 64));
writeFileSync(new URL("apple-touch-icon.png", OUT), png(iconGrid(false), 180, 2));
console.log("Wrote favicon.svg, favicon.png and apple-touch-icon.png");
