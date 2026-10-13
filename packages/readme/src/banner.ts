/**
 * The README's hero: a strip of the pixel town. Home and the Dev Center on the left, the Town
 * Hall notice board with Dan's name in the middle, Dan's twin beside it, and the Lab and Crate &
 * Closet on the right. By day (light) clouds drift past; at night (dark) the windows and street
 * lamps are lit and the stars twinkle, like the site after dusk.
 */
import { cellColour, compose, TWIN_PALETTE } from "../../../apps/web/src/town/sprites.ts";
import { ADVANCE, doc, esc, FAMILY, type FontData, type FontKey } from "./svg.ts";
import { TOWN, type Mode } from "./theme.ts";

/** One scene pixel, in screen pixels. */
const P = 5;
const COLS = 166;
const ROWS = 48;
export const BANNER_W = COLS * P;
export const BANNER_H = ROWS * P;
/** The top row of the ground. */
const GROUND = 36;

/** Deterministic noise, so the scene is identical on every build (as in world.ts). */
function noise(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** The largest font size up to `max` at which the text fits the width. */
const fit = (s: string, font: FontKey, max: number, width: number) =>
  Math.min(max, Math.floor(width / ([...s].length * ADVANCE[font])));

class Pixels {
  private out: string[] = [];
  rect(x: number, y: number, w: number, h: number, fill: string, extra = "") {
    this.out.push(`<rect x="${x * P}" y="${y * P}" width="${w * P}" height="${h * P}" fill="${fill}"${extra ? ` ${extra}` : ""}/>`);
  }
  raw(s: string) {
    this.out.push(s);
  }
  toString() {
    return this.out.join("");
  }
}

type BuildingTheme = { wall: string; roof: string; roofDark: string; trim: string };

/** A house: stepped roof, walls, windows, a door and a name plate. */
function building(px: Pixels, x: number, w: number, wallH: number, th: BuildingTheme, name: string, night: boolean) {
  const top = GROUND - wallH;
  const ink = TOWN.ink;
  // Walls with an outline.
  px.rect(x, top, w, wallH, ink);
  px.rect(x + 1, top + 1, w - 2, wallH - 1, th.wall);
  // Roof: rows that narrow upward, overhanging the walls by one pixel.
  const roofRows = Math.ceil(w / 4);
  for (let i = 0; i < roofRows; i++) {
    const inset = i * 2 - 1;
    const rw = w - inset * 2;
    if (rw <= 2) break;
    const ry = top - 1 - i;
    px.rect(x + inset, ry, rw, 1, ink);
    if (rw > 2) px.rect(x + inset + 1, ry, rw - 2, 1, i === 0 ? th.roofDark : th.roof);
  }
  // Name plate under the eaves.
  px.rect(x + 2, top + 2, w - 4, 3, th.trim);
  px.raw(
    `<text x="${(x + w / 2) * P}" y="${(top + 5) * P - 2}" text-anchor="middle" font-family="${FAMILY.retro}" font-size="7" fill="${ink}">${esc(name)}</text>`,
  );
  // Windows either side of the door.
  const win = night ? TOWN.windowLit : TOWN.window;
  const doorX = x + Math.floor(w / 2) - 2;
  for (const wx of [x + 1, x + w - 5]) {
    px.rect(wx, top + 8, 4, 4, ink);
    px.rect(wx + 1, top + 9, 2, 2, win, night ? `class="lit"` : "");
  }
  px.rect(doorX, GROUND - 6, 4, 6, ink);
  px.rect(doorX + 1, GROUND - 5, 2, 5, "#9c6a3f");
}

function tree(px: Pixels, x: number) {
  px.rect(x + 2, GROUND - 4, 2, 4, TOWN.trunk);
  px.rect(x, GROUND - 11, 6, 7, TOWN.canopyDark);
  px.rect(x + 1, GROUND - 12, 4, 8, TOWN.canopy);
  px.rect(x + 1, GROUND - 11, 2, 2, TOWN.canopyLight);
}

function lamp(px: Pixels, x: number, night: boolean) {
  if (night) {
    px.rect(x - 3, GROUND - 13, 7, 7, TOWN.windowLit, `opacity="0.12"`);
    px.rect(x - 2, GROUND - 12, 5, 5, TOWN.windowLit, `opacity="0.18"`);
  }
  px.rect(x, GROUND - 9, 1, 9, "#3b3a45");
  px.rect(x - 1, GROUND - 11, 3, 2, "#3b3a45");
  px.rect(x, GROUND - 10, 1, 1, night ? TOWN.windowLit : "#e9eef5", night ? `class="lit"` : "");
}

/** Dan's twin, standing on the path, with an idle bob. */
function sprite(px: Pixels, x: number, y: number) {
  const rows = compose("down", 0, true);
  const cells: string[] = [];
  rows.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      const c = cellColour(TWIN_PALETTE, ch, ry);
      if (c) cells.push(`<rect x="${(x + rx) * P}" y="${(y + ry) * P}" width="${P}" height="${P}" fill="${c}"/>`);
    }),
  );
  px.rect(x + 1, y + rows.length - 1, 10, 1, "#000000", `opacity="0.18"`);
  px.raw(`<g class="bob">${cells.join("")}</g>`);
}

export interface BannerData {
  name: string;
  headline: string;
  credits: string;
}

export function renderBanner(d: BannerData, mode: Mode, fonts: FontData): string {
  const night = mode === "dark";
  const px = new Pixels();

  // Sky in three bands, and the sun or moon.
  const sky = night ? ["#0b1020", "#111a33", "#1a2547"] : ["#7cc8f2", "#9ad6f6", "#b3e2fa"];
  px.rect(0, 0, COLS, 12, sky[0]!);
  px.rect(0, 12, COLS, 12, sky[1]!);
  px.rect(0, 24, COLS, GROUND - 24, sky[2]!);
  if (night) {
    for (let i = 0; i < 46; i++) {
      const sx = Math.floor(noise(i, 7) * COLS);
      const sy = Math.floor(noise(i, 13) * 26);
      px.rect(sx, sy, 1, 1, "#dfe7ff", `class="star s${i % 3}"`);
    }
    px.rect(148, 4, 6, 6, "#f4efe2");
    px.rect(147, 5, 8, 4, "#f4efe2");
    px.rect(150, 5, 3, 3, sky[0]!);
  } else {
    px.rect(147, 3, 8, 8, "#ffc857");
    px.rect(146, 5, 10, 4, "#ffc857");
    px.rect(149, 2, 4, 10, "#ffc857");
    // Clouds drift across and wrap around.
    const cloud = (cx: number, cy: number) => {
      const g = new Pixels();
      g.rect(cx, cy, 12, 3, "#ffffff");
      g.rect(cx + 3, cy - 2, 6, 2, "#ffffff");
      g.rect(cx + 1, cy + 3, 10, 1, "#e8f6ff");
      return g.toString();
    };
    px.raw(`<g class="clouds">${cloud(10, 6)}${cloud(70, 11)}${cloud(120, 4)}${cloud(10 + COLS, 6)}${cloud(70 + COLS, 11)}${cloud(120 + COLS, 4)}</g>`);
  }

  // Ground: grass with tufts and flowers, and the main road.
  px.rect(0, GROUND, COLS, ROWS - GROUND, night ? "#5f8f47" : TOWN.grass);
  for (let x = 0; x < COLS; x++)
    for (let y = GROUND; y < ROWS; y++) {
      const n = noise(x, y);
      if (n < 0.05) px.rect(x, y, 1, 1, night ? "#557f40" : TOWN.grassDark);
      else if (n > 0.985) px.rect(x, y, 1, 1, night ? "#9cb8d8" : TOWN.flowers[Math.floor(noise(y, x) * 4)]!);
    }
  const road = night ? ["#b9a27a", "#a08a63"] : [TOWN.path, TOWN.pathEdge];
  px.rect(0, 40, COLS, 4, road[0]!);
  px.rect(0, 40, COLS, 1, road[1]!);
  px.rect(0, 43, COLS, 1, road[1]!);

  // Left: Home and the Dev Center.
  tree(px, 0);
  building(px, 7, 22, 12, TOWN.buildings.home, "HOME", night);
  building(px, 32, 24, 15, TOWN.buildings.dev, "DEV", night);
  lamp(px, 58, night);

  // Middle: the Town Hall notice board on two posts.
  const bx = 61, bw = 56, by = 5, bh = 25;
  const inner = (bw - 6) * P;
  px.rect(bx + 6, by + bh, 2, GROUND - by - bh, TOWN.plaque);
  px.rect(bx + bw - 8, by + bh, 2, GROUND - by - bh, TOWN.plaque);
  px.rect(bx, by, bw, bh, TOWN.plaque);
  px.rect(bx + 1, by + 1, bw - 2, bh - 2, TOWN.woodFrame);
  px.rect(bx + 2, by + 2, bw - 4, bh - 4, night ? "#1b2340" : "#fff8ee");
  const cx = (bx + bw / 2) * P;
  const ink = night ? "#3ee6ff" : "#3b2f2a";
  px.raw(
    `<text x="${cx}" y="${(by + 9) * P}" text-anchor="middle" font-family="${FAMILY.retro}" font-size="${fit(d.name, "retro", 20, inner)}" fill="${ink}">${esc(d.name.toUpperCase())}</text>` +
      `<text x="${cx}" y="${(by + 15) * P}" text-anchor="middle" font-family="${FAMILY.pixel}" font-weight="600" font-size="${fit(d.headline, "pixel", 20, inner)}" fill="${night ? "#ffc857" : "#c4472a"}">${esc(d.headline)}</text>` +
      `<text x="${cx}" y="${(by + 20) * P}" text-anchor="middle" font-family="${FAMILY.term}" font-size="${fit(d.credits, "term", 20, inner)}" fill="${night ? "#8b9ac4" : "#6f5f55"}">${esc(d.credits)}</text>`,
  );
  // Pushpins in the board's corners.
  for (const [x, y, c] of [[bx + 3, by + 3, "#ff7a59"], [bx + bw - 4, by + 3, "#2bb3a3"]] as const) px.rect(x, y, 1, 1, c);

  // Dan, on the road beside the board.
  sprite(px, 119, 25);

  // Right: the Research Lab and Crate & Closet.
  lamp(px, 132, night);
  building(px, 134, 16, 13, TOWN.buildings.lab, "LAB", night);
  building(px, 151, 15, 11, TOWN.buildings.music, "CRATE", night);

  const css =
    `svg{shape-rendering:crispEdges}` +
    `.bob{animation:bob 1.6s steps(1) infinite}@keyframes bob{50%{transform:translateY(${P}px)}}` +
    `.clouds{animation:drift 90s linear infinite}@keyframes drift{to{transform:translateX(-${BANNER_W}px)}}` +
    `.star{animation:tw 3s steps(1) infinite}.s1{animation-delay:-1s}.s2{animation-delay:-2s}@keyframes tw{50%{opacity:.25}}` +
    `.lit{animation:flick 7s steps(1) infinite}@keyframes flick{93%{opacity:.7}}` +
    `@media (prefers-reduced-motion:reduce){.bob,.clouds,.star,.lit{animation:none}}`;
  return doc(BANNER_W, BANNER_H, px.toString(), {
    fonts: ["retro", "pixel", "term"],
    data: fonts,
    title: `${d.name}: ${d.headline}`,
    css,
  });
}
