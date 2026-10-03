/**
 * The inside of the Arcade: a room you walk into from the town, old-school RPG style.
 * The Mancala robot waits behind its table; talking to it opens the game.
 *
 * Ground legend:  # wall (solid) · . carpet
 */
import { TILE, type Point, type TownObject } from "./map.ts";

export const ARCADE_GROUND = [
  "###################", // 0  back wall
  "###################", // 1  back wall (sign, bulbs)
  "#.................#", // 2
  "#.................#", // 3
  "#.................#", // 4
  "#.................#", // 5
  "#.................#", // 6
  "#.................#", // 7
  "#.................#", // 8
  "#.................#", // 9
  "#.................#", // 10
  "#.................#", // 11
  "#.................#", // 12
  "#########.#########", // 13 front wall, exit mat in the gap
] as const;

const COLS = ARCADE_GROUND[0].length;
const ROWS = ARCADE_GROUND.length;

const note = (text: string) => ({ type: "note", text }) as const;
const cabinet = (id: string, x: number, style: string, text: string): TownObject => ({
  id,
  kind: "prop",
  x,
  y: 2,
  w: 1,
  h: 2,
  target: note(text),
  label: id.replace(/-/g, " "),
  style,
  hideLabel: true,
});

export const ARCADE_OBJECTS: readonly TownObject[] = [
  {
    id: "robot",
    kind: "npc",
    x: 8,
    y: 4,
    w: 3,
    h: 3,
    target: { type: "event", name: "mancala" },
    label: "Mancala Robot",
    style: "robot",
    labelLift: 22,
  },
  cabinet("Stone Muncher", 2, "#ff7a59", "High score: 48, set by ROBOT. Suspicious."),
  cabinet("Kalah Kart", 4, "#59f0d0", "Out of order. The robot says it “calculated too hard.”"),
  cabinet("Mega Mancala III", 6, "#c49bff", "Insert coin. You don't have a coin."),
  cabinet("Pit Fighter", 12, "#ffd166", "Every round so far has ended in a draw."),
  cabinet("Alpha-Beta Blasters", 14, "#7cc8f2", "Prunes most enemies before they even spawn."),
  cabinet("Space Seeders", 16, "#ff8fab", "Sow your stones, save the galaxy."),
  {
    id: "scoreboard",
    kind: "prop",
    x: 13,
    y: 1,
    w: 1,
    h: 1,
    target: { type: "event", name: "scoreboard" },
    label: "Scoreboard",
    style: "scoreboard",
    hideLabel: true,
  },
  { id: "vending", kind: "prop", x: 1, y: 6, w: 1, h: 2, target: note("Snacks: sold out. Bits: one left."), label: "Vending machine", style: "vending", hideLabel: true },
  { id: "claw", kind: "prop", x: 15, y: 8, w: 2, h: 2, target: note("A claw machine. The plush robot inside looks smug."), label: "Claw machine", style: "claw", hideLabel: true },
  { id: "plant-l", kind: "prop", x: 1, y: 12, w: 1, h: 1, target: note("A plastic plant. Low maintenance, like a good heuristic."), label: "Plant", style: "plant", hideLabel: true },
  { id: "plant-r", kind: "prop", x: 17, y: 12, w: 1, h: 1, target: note("Another plastic plant. It has seen many rematches."), label: "Plant", style: "plant", hideLabel: true },
  { id: "exit", kind: "exit", x: 9, y: 13, w: 1, h: 1, door: { x: 9, y: 13 }, target: { type: "place", id: "town" }, label: "Exit", style: "exit", hideLabel: true },
];

export const ARCADE_SPAWN: Point = { x: 9, y: 12 };

// ───────────────────────────── art ─────────────────────────────

const INK = "#1b1530";
const WALL = "#3a3160";
const WALL_DARK = "#251d40";
const CARPET = "#2a2147";
const CONFETTI = ["#59f0d0", "#ff7a59", "#ffd166", "#c49bff"];
const METAL = "#d5dde8";
const METAL_DARK = "#9aa8b8";
const FACE = "#7df9ff";

/** Deterministic noise so the room looks the same on every visit. */
function rand(x: number, y: number, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Ctx = CanvasRenderingContext2D;
const rect = (ctx: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

const FONT: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
};

function text(ctx: Ctx, s: string, x: number, y: number, color: string, size = 1) {
  [...s].forEach((ch, i) =>
    FONT[ch]?.forEach((row, ry) => [...row].forEach((c, rx) => c === "#" && rect(ctx, color, x + (i * 4 + rx) * size, y + ry * size, size, size))),
  );
}

function carpet(ctx: Ctx, tx: number, ty: number) {
  const px = tx * TILE;
  const py = ty * TILE;
  rect(ctx, CARPET, px, py, TILE, TILE);
  for (let i = 0; i < 2; i++) {
    if (rand(tx, ty, i + 7) < 0.45) continue;
    const col = CONFETTI[Math.floor(rand(tx, ty, i + 5) * CONFETTI.length)]!;
    const cx = px + 1 + Math.floor(rand(tx, ty, i) * 13);
    const cy = py + 1 + Math.floor(rand(tx, ty, i + 9) * 13);
    if (rand(tx, ty, i + 2) > 0.5) rect(ctx, col, cx, cy, 2, 1);
    else rect(ctx, col, cx, cy, 1, 2);
  }
}

function walls(ctx: Ctx) {
  const W = COLS * TILE;
  // Back wall with wainscoting and a row of bulbs.
  rect(ctx, WALL, 0, 0, W, 2 * TILE);
  rect(ctx, WALL_DARK, 0, 22, W, 10);
  rect(ctx, "#59f0d0", 0, 21, W, 1);
  for (let x = 4; x < W; x += 8) rect(ctx, (x / 8) % 2 ? "#ffd166" : "#ff7a59", x, 2, 2, 2);
  // Neon sign
  const sx = Math.round((W - 50) / 2);
  rect(ctx, INK, sx - 3, 4, 52, 16);
  rect(ctx, "rgba(255, 79, 184, 0.35)", sx - 2, 5, 50, 14);
  text(ctx, "ARCADE", sx, 7, "#ffd6f0", 2);
  // Posters
  for (const [x, col] of [
    [34, "#ffd166"],
    [W - 46, "#59f0d0"],
  ] as const) {
    rect(ctx, INK, x, 5, 12, 14);
    rect(ctx, col, x + 1, 6, 10, 12);
    rect(ctx, INK, x + 3, 9, 6, 1);
    rect(ctx, INK, x + 4, 12, 4, 4);
  }
  // Side and front walls
  for (let ty = 2; ty < ROWS; ty++) {
    rect(ctx, WALL_DARK, 0, ty * TILE, TILE, TILE);
    rect(ctx, WALL_DARK, W - TILE, ty * TILE, TILE, TILE);
  }
  rect(ctx, "#4b3f78", TILE - 1, 2 * TILE, 1, (ROWS - 3) * TILE);
  rect(ctx, "#4b3f78", W - TILE, 2 * TILE, 1, (ROWS - 3) * TILE);
  const fy = (ROWS - 1) * TILE;
  rect(ctx, WALL_DARK, 0, fy, W, TILE);
  rect(ctx, "#4b3f78", 0, fy, W, 1);
}

function exitMat(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, CARPET, px, py, TILE, TILE);
  rect(ctx, "#c4472a", px + 1, py + 1, 14, 13);
  rect(ctx, "#ff7a59", px + 2, py + 2, 12, 11);
  // Chevron pointing out of the room
  for (let i = 0; i < 4; i++) {
    rect(ctx, "#ffd166", px + 4 + i, py + 4 + i, 1, 2);
    rect(ctx, "#ffd166", px + 11 - i, py + 4 + i, 1, 2);
  }
}

function rug(ctx: Ctx) {
  const x = 7 * TILE;
  const y = 4 * TILE - 4;
  const w = 5 * TILE;
  const h = 5 * TILE;
  rect(ctx, "#ffd166", x, y, w, h);
  rect(ctx, "#b8405e", x + 2, y + 2, w - 4, h - 4);
  rect(ctx, "#d65a78", x + 6, y + 6, w - 12, h - 12);
  for (let i = x + 4; i < x + w - 4; i += 6) {
    rect(ctx, "#ffd166", i, y + 3, 2, 1);
    rect(ctx, "#ffd166", i, y + h - 4, 2, 1);
  }
}

function arcadeCabinet(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const top = o.y * TILE - 10;
  const H = o.h * TILE + 10;
  rect(ctx, "rgba(0,0,0,0.35)", px + 2, top + H - 2, 14, 3);
  rect(ctx, INK, px + 1, top, 14, H);
  rect(ctx, o.style, px + 2, top + 1, 12, H - 2);
  rect(ctx, "rgba(0,0,0,0.25)", px + 12, top + 1, 2, H - 2);
  // Marquee
  rect(ctx, "#fff8ee", px + 3, top + 2, 10, 3);
  rect(ctx, o.style, px + 5, top + 3, 6, 1);
  // Screen with a little game on it
  rect(ctx, INK, px + 3, top + 7, 10, 10);
  rect(ctx, "#14202c", px + 4, top + 8, 8, 8);
  for (let i = 0; i < 4; i++) {
    const col = CONFETTI[Math.floor(rand(o.x, i, 3) * CONFETTI.length)]!;
    rect(ctx, col, px + 5 + Math.floor(rand(o.x, i, 1) * 6), top + 9 + Math.floor(rand(o.x, i, 2) * 6), 1, 1);
  }
  rect(ctx, "#ffffff", px + 5, top + 9, 1, 1);
  // Control deck: joystick and buttons
  rect(ctx, INK, px + 1, top + 18, 14, 5);
  rect(ctx, METAL_DARK, px + 2, top + 19, 12, 3);
  rect(ctx, "#e63946", px + 4, top + 18, 2, 2);
  rect(ctx, INK, px + 5, top + 20, 1, 1);
  rect(ctx, "#ffd166", px + 8, top + 20, 2, 1);
  rect(ctx, "#59f0d0", px + 11, top + 20, 2, 1);
  // Coin door
  rect(ctx, INK, px + 5, top + 27, 6, 5);
  rect(ctx, "#ff7a59", px + 7, top + 28, 2, 1);
}

function vending(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const top = o.y * TILE - 8;
  const H = o.h * TILE + 8;
  rect(ctx, INK, px, top, 16, H);
  rect(ctx, "#e63946", px + 1, top + 1, 14, H - 2);
  rect(ctx, INK, px + 2, top + 3, 9, 26);
  rect(ctx, "#bfe6ff", px + 3, top + 4, 7, 24);
  for (let r = 0; r < 4; r++) rect(ctx, r === 1 ? "#bfe6ff" : CONFETTI[r % CONFETTI.length]!, px + 4, top + 5 + r * 6, 5, 3);
  rect(ctx, "#ffd166", px + 12, top + 6, 2, 4);
  rect(ctx, INK, px + 3, top + 32, 8, 4);
}

function claw(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const top = o.y * TILE - 10;
  const W = o.w * TILE;
  const H = o.h * TILE + 10;
  rect(ctx, "rgba(0,0,0,0.35)", px + 2, top + H - 2, W, 3);
  rect(ctx, INK, px, top, W, H);
  rect(ctx, "#ffd166", px + 1, top + 1, W - 2, 4);
  // Glass case
  rect(ctx, "#bfe6ff", px + 2, top + 6, W - 4, 20);
  rect(ctx, "#e8f6ff", px + 3, top + 7, 2, 18);
  // The claw
  rect(ctx, METAL_DARK, px + 14, top + 6, 1, 7);
  rect(ctx, METAL_DARK, px + 12, top + 13, 5, 1);
  rect(ctx, METAL_DARK, px + 12, top + 14, 1, 2);
  rect(ctx, METAL_DARK, px + 16, top + 14, 1, 2);
  // Prize pile, including a tiny robot plush
  const prizes = ["#ff8fab", "#59f0d0", "#c49bff", "#ffd166", "#ff7a59"];
  prizes.forEach((c, i) => rect(ctx, c, px + 4 + i * 5, top + 21 + (i % 2), 4, 5 - (i % 2)));
  rect(ctx, METAL, px + 19, top + 18, 4, 4);
  rect(ctx, FACE, px + 20, top + 19, 1, 1);
  rect(ctx, FACE, px + 22, top + 19, 1, 1);
  // Base
  rect(ctx, "#ff8fab", px + 1, top + 27, W - 2, H - 28);
  rect(ctx, INK, px + 12, top + 31, 8, 3);
}

function plant(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, "#4f9d4a", px + 3, py - 4, 10, 8);
  rect(ctx, "#6dbb5b", px + 5, py - 6, 6, 6);
  rect(ctx, "#3a7a3a", px + 2, py + 1, 3, 3);
  rect(ctx, "#3a7a3a", px + 11, py + 1, 3, 3);
  rect(ctx, INK, px + 4, py + 6, 8, 9);
  rect(ctx, "#c98f5c", px + 5, py + 7, 6, 7);
}

/** An LED scoreboard on the back wall. Its numbers are live: bump it to read the robot's record. */
function scoreboard(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE - 5;
  const y = o.y * TILE - 13;
  rect(ctx, INK, x, y, 26, 18);
  rect(ctx, "#0b0d14", x + 1, y + 1, 24, 16);
  // Three rows of LED "scores": green wins, red losses.
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) rect(ctx, "#7dffb0", x + 3 + c * 2, y + 3 + r * 4, 1, 2);
    for (let c = 0; c < 3; c++) rect(ctx, "#ff6b6b", x + 14 + c * 2, y + 3 + r * 4, 1, 2);
  }
  rect(ctx, "#ffd166", x + 11, y + 18, 4, 2);
}

/** The robot standing behind its Mancala table. Its face matches the robot in the game. */
function robotAndTable(ctx: Ctx, o: TownObject) {
  const cx = (o.x + o.w / 2) * TILE; // centre line
  const y0 = o.y * TILE;
  // Antenna
  rect(ctx, INK, cx - 1, y0 - 20, 2, 7);
  rect(ctx, INK, cx - 3, y0 - 24, 6, 5);
  rect(ctx, "#7dffb0", cx - 2, y0 - 23, 4, 3);
  // Head and ears
  rect(ctx, INK, cx - 12, y0 - 14, 24, 19);
  rect(ctx, METAL, cx - 11, y0 - 13, 22, 17);
  rect(ctx, INK, cx - 14, y0 - 9, 3, 8);
  rect(ctx, INK, cx + 11, y0 - 9, 3, 8);
  rect(ctx, "#14202c", cx - 8, y0 - 10, 16, 11);
  rect(ctx, FACE, cx - 5, y0 - 7, 2, 3);
  rect(ctx, FACE, cx + 3, y0 - 7, 2, 3);
  rect(ctx, FACE, cx - 3, y0 - 2, 6, 1);
  rect(ctx, FACE, cx - 4, y0 - 3, 1, 1);
  rect(ctx, FACE, cx + 3, y0 - 3, 1, 1);
  // Neck, torso and arms reaching for the table
  rect(ctx, INK, cx - 4, y0 + 5, 8, 4);
  rect(ctx, INK, cx - 10, y0 + 8, 20, 10);
  rect(ctx, METAL, cx - 9, y0 + 9, 18, 9);
  rect(ctx, "#ff7a59", cx - 5, y0 + 11, 2, 2);
  rect(ctx, "#ffd166", cx - 1, y0 + 11, 2, 2);
  rect(ctx, "#59f0d0", cx + 3, y0 + 11, 2, 2);
  rect(ctx, INK, cx - 15, y0 + 9, 5, 10);
  rect(ctx, METAL_DARK, cx - 14, y0 + 10, 3, 9);
  rect(ctx, INK, cx + 10, y0 + 9, 5, 10);
  rect(ctx, METAL_DARK, cx + 11, y0 + 10, 3, 9);

  // Table
  const tx = o.x * TILE + 1;
  const ty = (o.y + 1) * TILE;
  const tw = o.w * TILE - 2;
  rect(ctx, "rgba(0,0,0,0.35)", tx + 2, ty + 30, tw, 3);
  rect(ctx, INK, tx, ty, tw, 24);
  rect(ctx, "#c98f5c", tx + 1, ty + 1, tw - 2, 18);
  rect(ctx, "#9c6a3f", tx + 1, ty + 19, tw - 2, 4);
  rect(ctx, INK, tx + 3, ty + 23, 3, 9);
  rect(ctx, INK, tx + tw - 6, ty + 23, 3, 9);
  // Mancala board on the table
  const bx = tx + 4;
  const by = ty + 3;
  const bw = tw - 8;
  rect(ctx, INK, bx, by, bw, 14);
  rect(ctx, "#8a5a3b", bx + 1, by + 1, bw - 2, 12);
  rect(ctx, "#5e3a22", bx + 2, by + 3, 4, 8);
  rect(ctx, "#5e3a22", bx + bw - 6, by + 3, 4, 8);
  for (let i = 0; i < 6; i++) {
    const pxp = bx + 9 + i * 4;
    for (const row of [by + 3, by + 8]) {
      rect(ctx, "#5e3a22", pxp, row, 3, 3);
      rect(ctx, CONFETTI[(i + row) % CONFETTI.length]!, pxp + 1, row + 1, 1, 1);
    }
  }
}

/** Bake the whole room into one canvas, like the town. */
export function bakeArcade(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext("2d")!;
  for (let ty = 2; ty < ROWS - 1; ty++) for (let tx = 1; tx < COLS - 1; tx++) carpet(ctx, tx, ty);
  walls(ctx);
  rug(ctx);
  for (const o of ARCADE_OBJECTS) {
    if (o.style === "exit") exitMat(ctx, o);
    else if (o.style === "robot") robotAndTable(ctx, o);
    else if (o.style === "vending") vending(ctx, o);
    else if (o.style === "claw") claw(ctx, o);
    else if (o.style === "plant") plant(ctx, o);
    else if (o.style === "scoreboard") scoreboard(ctx, o);
    else arcadeCabinet(ctx, o);
  }
  return canvas;
}
