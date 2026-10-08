/**
 * The inside of the Research Lab: where Dan's research lives, for anyone reading him as a future
 * PhD student. The poster wall holds a poster per research role or project, the whiteboard has what
 * he wants to study next, and the lab bench lays out the methods he has used. Each opens a console
 * from the Research Lab page (pages/lab.astro).
 *
 * Ground legend:  # wall (solid) · . tiled floor
 */
import { text } from "./dev.ts";
import { bitmap, rand, rect, type Ctx } from "./home.ts";
import { TILE, type Point, type TownObject } from "./map.ts";

export const LAB_GROUND = [
  "#############", // 0  back wall (poster wall · whiteboard)
  "#############", // 1
  "#...........#", // 2
  "#...........#", // 3  fume hood
  "#...........#", // 4
  "#...........#", // 5
  "#...........#", // 6
  "#...........#", // 7  lab bench
  "#...........#", // 8
  "#...........#", // 9  sample fridge
  "#...........#", // 10 bookshelf
  "#...........#", // 11
  "#...........#", // 12
  "#...........#", // 13
  "######.######", // 14 front wall, exit mat in the gap
] as const;

const COLS = LAB_GROUND[0].length;
const ROWS = LAB_GROUND.length;

const prop = (id: string, label: string, x: number, y: number, w: number, h: number, text: string): TownObject => ({
  id,
  kind: "prop",
  x,
  y,
  w,
  h,
  target: { type: "note", text },
  label,
  style: id,
  hideLabel: true,
});
const station = (id: string, label: string, x: number, y: number, w: number, h: number, hint: string, labelLift: number): TownObject => ({
  id,
  kind: "prop",
  x,
  y,
  w,
  h,
  target: { type: "event", name: id },
  label,
  style: id,
  labelLift,
  hint,
});

export const LAB_OBJECTS: readonly TownObject[] = [
  // ── Back wall ──
  station("lab-posters", "Poster wall", 1, 1, 4, 1, "Read the posters 📜", 28),
  station("lab-whiteboard", "Whiteboard", 6, 1, 5, 1, "Read the whiteboard ✏️", 28),

  // ── The floor ──
  station("lab-bench", "Lab bench", 4, 7, 5, 2, "Look over the bench 🧪", 6),
  prop("hood", "Fume hood", 11, 3, 1, 2, "A fume hood, humming. Nothing in it is on fire, which counts as a good day in a lab."),
  prop("fridge", "Sample fridge", 11, 9, 1, 2, "A sample fridge. The label on the door says NOT FOR LUNCH, underlined twice."),
  prop("shelf", "Bookshelf", 1, 10, 1, 2, "Journals, textbooks and a stack of printed papers with notes all over the margins."),
  prop("plant", "Plant", 11, 12, 1, 1, "A lab plant. Technically it's an uncontrolled variable."),
  { id: "exit", kind: "exit", x: 6, y: 14, w: 1, h: 1, door: { x: 6, y: 14 }, target: { type: "place", id: "town" }, label: "Exit", style: "exit", hideLabel: true },
];

export const LAB_SPAWN: Point = { x: 6, y: 13 };

// ───────────────────────────── art ─────────────────────────────

const INK = "#10201b";
const WALL = "#d9ece6";
const WALL_DARK = "#b9d6cc";
const WALL_EDGE = "#8fbfb0";
const FLOOR = "#eef3f1";
const FLOOR_SEAM = "#d3dedb";
const STEEL = "#a9b8bf";
const STEEL_DARK = "#7f9099";
const STEEL_LIGHT = "#d4dee3";
const BENCH = "#2d3a40";
const BENCH_TOP = "#3e5059";
const MINT = "#3f8f7a";
const GREEN = "#38c98a";
const BLUE = "#4a90d9";
const AMBER = "#f2a33a";
const RED = "#e2574c";
const PURPLE = "#8a6fbf";
const WHITE = "#ffffff";
const CORK = "#c89a64";

function floorTile(ctx: Ctx, tx: number, ty: number) {
  const px = tx * TILE;
  const py = ty * TILE;
  rect(ctx, FLOOR, px, py, TILE, TILE);
  // Lab tiles: four squares per tile.
  rect(ctx, FLOOR_SEAM, px, py, TILE, 1);
  rect(ctx, FLOOR_SEAM, px, py, 1, TILE);
  rect(ctx, FLOOR_SEAM, px + 8, py, 1, TILE);
  rect(ctx, FLOOR_SEAM, px, py + 8, TILE, 1);
  if (rand(tx, ty, 17) < 0.08) rect(ctx, "#dce8e4", px + 2, py + 2, 5, 5);
}

function walls(ctx: Ctx) {
  const W = COLS * TILE;
  rect(ctx, WALL, 0, 0, W, 2 * TILE);
  rect(ctx, WALL_DARK, 0, 0, W, 3);
  rect(ctx, WALL_DARK, 0, 26, W, 6);
  rect(ctx, MINT, 0, 25, W, 1);
  for (let ty = 2; ty < ROWS; ty++) {
    rect(ctx, WALL_DARK, 0, ty * TILE, TILE, TILE);
    rect(ctx, WALL_DARK, W - TILE, ty * TILE, TILE, TILE);
  }
  rect(ctx, WALL_EDGE, TILE - 1, 2 * TILE, 1, (ROWS - 3) * TILE);
  rect(ctx, WALL_EDGE, W - TILE, 2 * TILE, 1, (ROWS - 3) * TILE);
  const fy = (ROWS - 1) * TILE;
  rect(ctx, WALL_DARK, 0, fy, W, TILE);
  rect(ctx, WALL_EDGE, 0, fy, W, 1);
}

/** A cork board with three research posters pinned up. */
function posterWall(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE + 2;
  const y = 4;
  const w = o.w * TILE - 4;
  rect(ctx, INK, x - 1, y - 1, w + 2, 25);
  rect(ctx, CORK, x, y, w, 23);
  const accents = [BLUE, GREEN, PURPLE];
  for (let i = 0; i < 3; i++) {
    const px = x + 3 + i * 20;
    rect(ctx, "rgba(0,0,0,0.25)", px + 1, y + 3, 16, 18);
    rect(ctx, WHITE, px, y + 2, 16, 18);
    rect(ctx, accents[i]!, px, y + 2, 16, 3);
    // Title, two columns of text, and a figure.
    for (let l = 0; l < 3; l++) rect(ctx, "#b8c4cc", px + 2, y + 7 + l * 2, 5, 1);
    if (i === 1) {
      for (let b = 0; b < 3; b++) rect(ctx, accents[i]!, px + 9 + b * 2, y + 12 - b * 2, 1, 2 + b * 2);
    } else {
      rect(ctx, accents[i]!, px + 9, y + 7, 5, 5);
      rect(ctx, WHITE, px + 10, y + 8, 3, 3);
    }
    for (let l = 0; l < 2; l++) rect(ctx, "#b8c4cc", px + 2, y + 14 + l * 2, 12, 1);
    rect(ctx, RED, px + 7, y + 2, 2, 1);
  }
}

/** The whiteboard: what's next, with a plot and a few arrows. */
function whiteboard(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE + 2;
  const y = 4;
  const w = o.w * TILE - 4;
  rect(ctx, INK, x - 1, y - 1, w + 2, 25);
  rect(ctx, STEEL_DARK, x, y, w, 23);
  rect(ctx, WHITE, x + 1, y + 1, w - 2, 20);
  rect(ctx, STEEL, x + 6, y + 21, 20, 2);
  rect(ctx, RED, x + 9, y + 21, 3, 1);
  rect(ctx, BLUE, x + 14, y + 21, 3, 1);
  text(ctx, "NEXT:", x + 4, y + 4, BLUE);
  // A few bullet lines under "NEXT:".
  for (let l = 0; l < 3; l++) {
    rect(ctx, BLUE, x + 4, y + 11 + l * 3, 1, 1);
    rect(ctx, "#5a6d78", x + 6, y + 11 + l * 3, 14 + Math.floor(rand(l, 2, 5) * 12), 1);
  }
  // A plot with a rising curve, on the right.
  const gx = x + w - 30;
  rect(ctx, INK, gx, y + 4, 1, 14);
  rect(ctx, INK, gx, y + 17, 26, 1);
  for (let k = 0; k < 24; k++) rect(ctx, RED, gx + 1 + k, y + 16 - Math.round((k * k) / 48), 1, 1);
  for (let k = 0; k < 6; k++) rect(ctx, GREEN, gx + 3 + k * 4, y + 15 - Math.round(rand(k, 1, 9) * 8), 1, 1);
}

/** The lab bench: a microscope, glassware and a laptop running the analysis. */
function bench(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  const w = o.w * TILE;
  const h = o.h * TILE;
  rect(ctx, "rgba(0,0,0,0.18)", x + 2, y + h, w, 3);
  rect(ctx, INK, x, y + 4, w, h - 4);
  rect(ctx, BENCH_TOP, x + 1, y + 5, w - 2, 12);
  rect(ctx, "#4d6470", x + 1, y + 5, w - 2, 1);
  rect(ctx, BENCH, x + 1, y + 17, w - 2, h - 18);
  for (let d = 0; d < 3; d++) rect(ctx, "#4d6470", x + 8 + d * 26, y + 21, 10, 1);
  // Microscope on the left.
  bitmap(ctx, ["..kk..", "..kk..", ".kkkk.", "..kk.k", "..kkkk", ".ssss.", "kkkkkk"], x + 6, y - 2, { k: "#3a4448", s: STEEL_LIGHT });
  // A laptop in the middle: its screen is drawn live.
  rect(ctx, INK, x + 22, y - 3, 18, 11);
  rect(ctx, "#203038", x + 23, y - 2, 16, 9);
  rect(ctx, STEEL, x + 20, y + 8, 22, 3);
  // Glassware on the right: a beaker, test tubes in a rack, and the flask (drawn live).
  rect(ctx, INK, x + 56, y + 2, 7, 9);
  rect(ctx, "#cfe9f5", x + 57, y + 3, 5, 7);
  rect(ctx, BLUE, x + 57, y + 6, 5, 4);
  rect(ctx, STEEL_DARK, x + 66, y + 6, 10, 2);
  for (const [i, c] of [RED, AMBER, GREEN].entries()) {
    rect(ctx, INK, x + 67 + i * 3, y - 1, 2, 8);
    rect(ctx, c, x + 67 + i * 3, y + 3, 2, 4);
  }
}

function hood(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const top = o.y * TILE - 8;
  rect(ctx, "rgba(0,0,0,0.18)", x + 2, top + 40, 14, 3);
  rect(ctx, INK, x, top, 16, 40);
  rect(ctx, STEEL, x + 1, top + 1, 14, 38);
  rect(ctx, STEEL_LIGHT, x + 1, top + 1, 14, 2);
  rect(ctx, "#bfe3ee", x + 2, top + 8, 12, 16);
  rect(ctx, "#e6f6fb", x + 3, top + 9, 3, 6);
  rect(ctx, STEEL_DARK, x + 2, top + 25, 12, 2);
  rect(ctx, STEEL_DARK, x + 2, top + 30, 12, 8);
}

function fridge(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE + 1;
  const top = o.y * TILE - 6;
  rect(ctx, "rgba(0,0,0,0.18)", x + 2, top + 38, 14, 3);
  rect(ctx, INK, x, top, 14, 38);
  rect(ctx, "#e9eef0", x + 1, top + 1, 12, 36);
  rect(ctx, STEEL, x + 1, top + 14, 12, 1);
  rect(ctx, STEEL_DARK, x + 10, top + 5, 1, 6);
  rect(ctx, STEEL_DARK, x + 10, top + 18, 1, 8);
  // The biohazard-yellow label.
  rect(ctx, "#ffd23f", x + 3, top + 4, 5, 4);
}

function shelf(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE + 1;
  const top = o.y * TILE - 8;
  rect(ctx, "rgba(0,0,0,0.18)", x + 2, top + 40, 14, 3);
  rect(ctx, INK, x, top, 14, 40);
  rect(ctx, "#8a5a3b", x + 1, top + 1, 12, 38);
  const spines = [BLUE, RED, GREEN, AMBER, PURPLE, WHITE, MINT];
  for (let s = 0; s < 4; s++) {
    const sy = top + 2 + s * 9;
    rect(ctx, "#5e3d28", x + 1, sy + 8, 12, 1);
    for (let b = 0; b < 5; b++) {
      const bh = 5 + Math.floor(rand(s, b, 3) * 3);
      rect(ctx, spines[(s * 3 + b) % spines.length]!, x + 2 + b * 2, sy + 8 - bh, 2, bh);
    }
  }
}

function plant(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, "#2f8a55", px + 3, py - 4, 10, 8);
  rect(ctx, "#47b06f", px + 5, py - 6, 6, 6);
  rect(ctx, "#236b42", px + 2, py + 1, 3, 3);
  rect(ctx, "#236b42", px + 11, py + 1, 3, 3);
  rect(ctx, INK, px + 4, py + 6, 8, 9);
  rect(ctx, "#c98f5c", px + 5, py + 7, 6, 7);
}

function exitMat(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, FLOOR, px, py, TILE, TILE);
  rect(ctx, "#2d6b5b", px + 1, py + 1, 14, 13);
  rect(ctx, MINT, px + 2, py + 2, 12, 11);
  for (let i = 0; i < 4; i++) {
    rect(ctx, WHITE, px + 4 + i, py + 4 + i, 1, 2);
    rect(ctx, WHITE, px + 11 - i, py + 4 + i, 1, 2);
  }
}

/** Bake the whole room into one canvas, like the town. */
export function bakeLab(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext("2d")!;
  for (let ty = 2; ty < ROWS - 1; ty++) for (let tx = 1; tx < COLS - 1; tx++) floorTile(ctx, tx, ty);
  walls(ctx);
  for (const o of LAB_OBJECTS) {
    if (o.style === "lab-posters") posterWall(ctx, o);
    else if (o.style === "lab-whiteboard") whiteboard(ctx, o);
    else if (o.style === "lab-bench") bench(ctx, o);
    else if (o.style === "hood") hood(ctx, o);
    else if (o.style === "fridge") fridge(ctx, o);
    else if (o.style === "shelf") shelf(ctx, o);
    else if (o.style === "plant") plant(ctx, o);
    else if (o.style === "exit") exitMat(ctx, o);
  }
  return canvas;
}

// ───────────────────────────── live layer ─────────────────────────────

const BENCH_OBJ = LAB_OBJECTS.find((o) => o.id === "lab-bench")!;

/** The flask on the bench bubbles, and the laptop plots a line that grows. */
export function drawLabLive(ctx: Ctx, _player: Point) {
  const now = Date.now();
  const x = BENCH_OBJ.x * TILE;
  const y = BENCH_OBJ.y * TILE;
  const tick = Math.floor(now / 1000);
  // The flask, then two bubbles rising out of it.
  const fx = x + 48;
  const fy = y - 1;
  bitmap(ctx, ["..oo..", "..oo..", ".o..o.", "oggggo", "oggggo", ".oooo."], fx - 2, fy, { o: INK, g: GREEN });
  for (let b = 0; b < 2; b++) {
    const rise = (tick + b * 2) % 4;
    rect(ctx, "#9ff0c6", fx + (b ? 1 : 0), fy - 1 - rise, 1, 1);
  }
  // The laptop: a line chart that adds a point a second, then starts over.
  rect(ctx, "#203038", x + 23, y - 2, 16, 9);
  const n = (tick % 8) + 1;
  for (let k = 0; k < n; k++) rect(ctx, GREEN, x + 24 + k * 2, y + 5 - Math.round(rand(k, 4, 2) * 2 + k * 0.5), 2, 1);
}
