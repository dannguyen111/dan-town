/**
 * The inside of the Dev Center: a mission-control room. The big viewscreen on the back wall runs
 * the timeline of Dan's projects and roles, the radar console sweeps his tech stack, and the
 * telemetry wall shows his live GitHub and LeetCode numbers. LeBronette, the flight controller at
 * the front desk, talks visitors through all of it (and books meetings with Dan).
 *
 * The screens draw from a small feed the Dev Center page fills in (setDevFeed), so the town bundle
 * never carries the profile. Until then they show a standby pattern.
 *
 * Ground legend:  # wall (solid) · . raised floor
 */
import { PIXEL_FONT } from "../lib/stack-meta.ts";
import { bitmap, easternTime, rand, rect, type Ctx } from "./home.ts";
import { TILE, type Point, type TownObject } from "./map.ts";

export const DEV_GROUND = [
  "###############", // 0  back wall (sign, viewscreen, mission clock)
  "###############", // 1
  "#.............#", // 2
  "#.............#", // 3  radar console · telemetry wall
  "#.............#", // 4
  "#.............#", // 5
  "#.............#", // 6
  "#.............#", // 7
  "#.............#", // 8  three flight consoles
  "#.............#", // 9
  "#.............#", // 10
  "#.............#", // 11 whiteboard · server rack
  "#.............#", // 12
  "#.............#", // 13 front desk (LeBronette)
  "#.............#", // 14
  "#.............#", // 15
  "#.............#", // 16
  "#.............#", // 17
  "#######.#######", // 18 front wall, exit mat in the gap
] as const;

const COLS = DEV_GROUND[0].length;
const ROWS = DEV_GROUND.length;

const note = (text: string) => ({ type: "note", text }) as const;
const prop = (id: string, label: string, x: number, y: number, w: number, h: number, text: string): TownObject => ({
  id,
  kind: "prop",
  x,
  y,
  w,
  h,
  target: note(text),
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

export const DEV_OBJECTS: readonly TownObject[] = [
  // ── Back wall ──
  station("timeline", "Viewscreen", 4, 1, 7, 1, "Open the mission timeline ▶", 28),
  { id: "dev-clock", kind: "prop", x: 12, y: 1, w: 2, h: 1, target: { type: "event", name: "dev-clock" }, label: "Mission clock", style: "dev-clock", hideLabel: true },

  // ── Stations ──
  station("radar", "Stack radar", 1, 3, 2, 2, "Scan the stack ◎", 0),
  station("telemetry", "Telemetry", 12, 3, 2, 3, "Read the telemetry 📈", -6),

  // ── Flight consoles: how this site is built ──
  prop(
    "console-wasm",
    "Rust console",
    2,
    8,
    3,
    1,
    "Rust → WebAssembly. Dan's Java Mancala bot, ported to Rust: about 37 KB of WASM in a Web Worker. A parity suite proves it picks the same move as the Java original on 247 recorded positions. Go beat it in the Arcade.",
  ),
  prop(
    "console-edge",
    "Edge console",
    6,
    8,
    3,
    1,
    "Edge API. One Cloudflare Worker serves the site, refreshes GitHub, LeetCode and Spotify once a day, and runs the twin (and LeBronette) with rate limits. Secrets never reach your browser.",
  ),
  prop(
    "console-static",
    "Static console",
    10,
    8,
    3,
    1,
    "Static first. Astro renders every page to HTML at build time; JavaScript only loads for the town, the chats and the Arcade. The engine is a few hundred lines of TypeScript, and it sleeps when you stand still.",
  ),

  // ── Lower deck ──
  prop(
    "whiteboard",
    "Whiteboard",
    1,
    11,
    1,
    2,
    "A diagram: profile.yaml → site, twin and LeBronette. Everything in town is compiled from one private, schema-checked file, and pushing to it rebuilds them all.",
  ),
  prop("rack", "Server rack", 13, 11, 1, 2, "The whole town runs on Cloudflare's free tier. Monthly hosting bill: $0.00. The blinking is mostly for show."),
  prop("coffee", "Coffee machine", 13, 14, 1, 1, "Launch fuel. Dan's order back home is a Vietnamese iced coffee, so this machine is a compromise."),
  prop("plant", "Plant", 1, 16, 1, 1, "A desk plant. It has survived every deploy so far."),

  // ── Front desk ──
  {
    id: "lebronette",
    kind: "npc",
    x: 6,
    y: 13,
    w: 3,
    h: 2,
    // Her chat opens beside the room, like the twin's at Home (pages/reception.astro).
    target: { type: "place", id: "reception" },
    label: "LeBronette",
    style: "lebronette",
    labelLift: 6,
    hint: "Talk to LeBronette 🎧",
  },
  { id: "exit", kind: "exit", x: 7, y: 18, w: 1, h: 1, door: { x: 7, y: 18 }, target: { type: "place", id: "town" }, label: "Exit", style: "exit", hideLabel: true },
];

export const DEV_SPAWN: Point = { x: 7, y: 17 };

// ───────────────────────────── the feed ─────────────────────────────

/** What the room's screens show. Filled in by the Dev Center page (pages/dev.astro). */
export interface DevFeed {
  /** Projects and roles, oldest first. `label` is short and upper case, e.g. "VENDORA" or "KPMG". */
  timeline: { label: string; kind: "project" | "role"; year: string; t: number }[];
  /** Radar blips: r is 0 (centre, used most) to 1 (edge); a is the angle in radians. */
  blips: { hex: string; r: number; a: number }[];
  /** Contribution levels (0–4), one per day, oldest first. */
  heat: number[] | null;
  streak: number | null;
  leet: { easy: number; medium: number; hard: number; totals: { easy: number; medium: number; hard: number } } | null;
}

const feed: DevFeed = { timeline: [], blips: [], heat: null, streak: null, leet: null };

export function setDevFeed(next: Partial<DevFeed>) {
  Object.assign(feed, next);
}

/** Which timeline entry the viewscreen shows at time `now` (ms). */
export const TIMELINE_STEP_MS = 2500;
export const timelineIndex = (now: number, n: number) => (n ? Math.floor(now / TIMELINE_STEP_MS) % n : -1);

/** Current streak in days, counting back from the most recent day (today may still be empty). */
export function streakOf(calendar: readonly { count: number }[]): number {
  let i = calendar.length - 1;
  if (i >= 0 && calendar[i]!.count === 0) i--;
  let n = 0;
  for (; i >= 0 && calendar[i]!.count > 0; i--) n++;
  return n;
}

// ───────────────────────────── art ─────────────────────────────

const INK = "#070a14";
const WALL = "#151c33";
const WALL_DARK = "#0e1324";
const WALL_EDGE = "#26325c";
const FLOOR = "#18203a";
const FLOOR_SEAM = "#111830";
const FLOOR_LIGHT = "#202a4a";
const STEEL = "#3a4670";
const STEEL_DARK = "#2b3556";
const STEEL_LIGHT = "#56659a";
const SCREEN = "#041320";
const CYAN = "#3ee6ff";
const CYAN_DIM = "#1d6f86";
const GREEN = "#7dffb0";
const AMBER = "#ffc857";
const RED = "#ff5a6a";
const WHITE = "#f4f7ff";
const PURPLE = "#552583";
const GOLD = "#fdb927";

/** 3×5 pixel text, 4px per character. Unknown characters (spaces) just advance. */
function text(ctx: Ctx, s: string, x: number, y: number, color: string) {
  [...s.toUpperCase()].forEach((ch, i) =>
    PIXEL_FONT[ch]?.forEach((row, ry) => [...row].forEach((c, rx) => c === "#" && rect(ctx, color, x + i * 4 + rx, y + ry, 1, 1))),
  );
}
const textWidth = (s: string) => s.length * 4 - 1;

function disc(ctx: Ctx, color: string, cx: number, cy: number, r: number) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    rect(ctx, color, cx - w, cy + dy, w * 2 + 1, 1);
  }
}

function floorTile(ctx: Ctx, tx: number, ty: number) {
  const px = tx * TILE;
  const py = ty * TILE;
  rect(ctx, FLOOR, px, py, TILE, TILE);
  rect(ctx, FLOOR_SEAM, px, py, TILE, 1);
  rect(ctx, FLOOR_SEAM, px, py, 1, TILE);
  rect(ctx, FLOOR_LIGHT, px + 2, py + 2, 1, 1);
  rect(ctx, FLOOR_LIGHT, px + 13, py + 13, 1, 1);
  // The odd vented panel, for airflow under the consoles.
  if (rand(tx, ty, 41) < 0.12) for (let i = 0; i < 4; i++) rect(ctx, FLOOR_SEAM, px + 4, py + 4 + i * 2, 8, 1);
}

function walls(ctx: Ctx) {
  const W = COLS * TILE;
  rect(ctx, WALL, 0, 0, W, 2 * TILE);
  rect(ctx, WALL_DARK, 0, 0, W, 3);
  rect(ctx, WALL_DARK, 0, 26, W, 6);
  rect(ctx, CYAN_DIM, 0, 25, W, 1);
  // Status lights along the top of the wall.
  for (let x = 6; x < W; x += 10) rect(ctx, x % 30 === 16 ? AMBER : CYAN_DIM, x, 4, 2, 1);
  // "MISSION CONTROL", stencilled left of the screen.
  text(ctx, "MISSION", 22, 9, CYAN);
  text(ctx, "CONTROL", 22, 16, CYAN);
  rect(ctx, CYAN_DIM, 20, 22, 31, 1);
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

/** The glow the viewscreen throws on the floor in front of it. */
function screenGlow(ctx: Ctx) {
  rect(ctx, "rgba(62, 230, 255, 0.07)", 3 * TILE, 2 * TILE, 9 * TILE, TILE);
  rect(ctx, "rgba(62, 230, 255, 0.05)", 4 * TILE, 3 * TILE, 7 * TILE, TILE);
}

const VIEW = { x: 4 * TILE + 3, y: 5, w: 7 * TILE - 6, h: 23 };

function viewscreen(ctx: Ctx) {
  rect(ctx, INK, VIEW.x - 3, VIEW.y - 3, VIEW.w + 6, VIEW.h + 6);
  rect(ctx, STEEL, VIEW.x - 2, VIEW.y - 2, VIEW.w + 4, VIEW.h + 4);
  rect(ctx, STEEL_LIGHT, VIEW.x - 2, VIEW.y - 2, VIEW.w + 4, 1);
  rect(ctx, SCREEN, VIEW.x, VIEW.y, VIEW.w, VIEW.h);
  // Brackets holding it to the wall.
  rect(ctx, STEEL_DARK, VIEW.x + 10, VIEW.y + VIEW.h + 3, 4, 2);
  rect(ctx, STEEL_DARK, VIEW.x + VIEW.w - 14, VIEW.y + VIEW.h + 3, 4, 2);
}

const CLOCK = { x: 12 * TILE + 2, y: 10, w: 28, h: 11 };

function clockBox(ctx: Ctx) {
  rect(ctx, INK, CLOCK.x - 1, CLOCK.y - 1, CLOCK.w + 2, CLOCK.h + 2);
  rect(ctx, SCREEN, CLOCK.x, CLOCK.y, CLOCK.w, CLOCK.h);
  text(ctx, "ET", CLOCK.x + 10, CLOCK.y - 7, CYAN_DIM);
}

const RADAR = { cx: 2 * TILE, cy: 3 * TILE + 9, r: 11 };

function radarConsole(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const top = o.y * TILE - 6;
  const W = o.w * TILE;
  rect(ctx, "rgba(0,0,0,0.35)", px + 2, top + 38, W - 2, 3);
  rect(ctx, INK, px, top, W, 38);
  rect(ctx, STEEL, px + 1, top + 1, W - 2, 36);
  rect(ctx, STEEL_LIGHT, px + 1, top + 1, W - 2, 1);
  // The round scope.
  disc(ctx, INK, RADAR.cx, RADAR.cy, RADAR.r + 2);
  disc(ctx, SCREEN, RADAR.cx, RADAR.cy, RADAR.r);
  // Control deck: dials and buttons.
  rect(ctx, STEEL_DARK, px + 2, top + 28, W - 4, 8);
  rect(ctx, AMBER, px + 5, top + 30, 2, 2);
  rect(ctx, GREEN, px + 10, top + 30, 2, 2);
  rect(ctx, RED, px + 15, top + 30, 2, 2);
  rect(ctx, INK, px + 21, top + 30, 6, 4);
  rect(ctx, CYAN_DIM, px + 22, top + 31, 4, 2);
}

const TELE = { x: 12 * TILE, y: 3 * TILE - 8, w: 2 * TILE, h: 3 * TILE + 4 };

function telemetryWall(ctx: Ctx) {
  const { x, y, w, h } = TELE;
  rect(ctx, "rgba(0,0,0,0.35)", x + 2, y + h, w - 2, 3);
  rect(ctx, INK, x, y, w, h);
  rect(ctx, STEEL_DARK, x + 1, y + 1, w - 2, h - 2);
  rect(ctx, SCREEN, x + 1, y + 2, w - 2, 23);
  rect(ctx, SCREEN, x + 1, y + 27, w - 2, 9);
  rect(ctx, SCREEN, x + 1, y + 38, w - 2, h - 40);
  text(ctx, "LC", x + 2, y + 40, CYAN_DIM);
}

/** A flight console: two monitors on a desk, art on the screens chosen by `kind`. */
function flightConsole(ctx: Ctx, o: TownObject, kind: "wasm" | "edge" | "static") {
  const px = o.x * TILE + 1;
  const W = o.w * TILE - 2;
  const top = o.y * TILE - 14;
  rect(ctx, "rgba(0,0,0,0.35)", px + 2, o.y * TILE + 15, W, 3);
  // Monitors
  for (const mx of [px + 4, px + W / 2 + 2]) {
    rect(ctx, INK, mx, top, W / 2 - 6, 13);
    rect(ctx, SCREEN, mx + 1, top + 1, W / 2 - 8, 10);
    rect(ctx, INK, mx + W / 4 - 4, top + 13, 2, 3);
  }
  const s1 = px + 5;
  const s2 = px + W / 2 + 3;
  const sy = top + 2;
  if (kind === "wasm") {
    // A tiny crab, and the purple WASM block.
    bitmap(ctx, ["r.r..r.r", ".rrrrrr.", "rrwrrwrr", ".rrrrrr.", "r.r..r.r"], s1 + 4, sy + 2, { r: "#f74c00", w: WHITE });
    rect(ctx, "#654ff0", s2 + 5, sy + 1, 8, 8);
    text(ctx, "WA", s2 + 6, sy + 3, WHITE);
  } else if (kind === "edge") {
    // An orange cloud, and requests per second.
    rect(ctx, "#f38020", s1 + 3, sy + 4, 11, 4);
    rect(ctx, "#f38020", s1 + 5, sy + 2, 5, 2);
    rect(ctx, "#fbad41", s1 + 9, sy + 3, 4, 2);
    for (let i = 0; i < 6; i++) rect(ctx, GREEN, s2 + 2 + i * 3, sy + 8 - Math.floor(rand(i, 3, 9) * 6), 2, 1 + Math.floor(rand(i, 3, 9) * 6));
  } else {
    // Lines of HTML, and a rocket.
    for (let i = 0; i < 4; i++) rect(ctx, i % 2 ? CYAN_DIM : CYAN, s1 + 2 + (i % 2) * 2, sy + 1 + i * 2, 8 + Math.floor(rand(i, 7, 2) * 5), 1);
    bitmap(ctx, ["..w..", ".www.", ".wcw.", ".www.", "ww.ww", ".o.o."], s2 + 6, sy + 2, { w: WHITE, c: CYAN, o: AMBER });
  }
  // The desk
  rect(ctx, INK, px, o.y * TILE, W, 16);
  rect(ctx, STEEL, px + 1, o.y * TILE + 1, W - 2, 5);
  rect(ctx, STEEL_LIGHT, px + 1, o.y * TILE + 1, W - 2, 1);
  rect(ctx, STEEL_DARK, px + 1, o.y * TILE + 6, W - 2, 9);
  for (let i = 0; i < 6; i++) rect(ctx, [AMBER, GREEN, CYAN, RED][i % 4]!, px + 5 + i * 6, o.y * TILE + 3, 2, 1);
  // Ferris rides on the Rust console's desk.
  if (kind === "wasm") bitmap(ctx, ["r...r", ".rrr.", "rwrwr", "rrrrr", "r.r.r"], px + W - 9, o.y * TILE - 4, { r: "#f74c00", w: WHITE });
}

function whiteboard(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE + 1;
  const top = o.y * TILE - 6;
  rect(ctx, INK, px, top, 14, 34);
  rect(ctx, "#e8ecf6", px + 1, top + 1, 12, 32);
  // profile.yaml at the top, arrows down to three boxes.
  rect(ctx, RED, px + 3, top + 3, 8, 4);
  rect(ctx, INK, px + 6, top + 7, 1, 6);
  rect(ctx, INK, px + 3, top + 12, 7, 1);
  for (const [i, c] of [CYAN_DIM, GREEN, AMBER].entries()) {
    rect(ctx, c, px + 2, top + 15 + i * 6, 10, 4);
  }
  rect(ctx, STEEL_DARK, px + 1, top + 33, 12, 2);
}

function rack(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE + 1;
  const top = o.y * TILE - 8;
  rect(ctx, "rgba(0,0,0,0.35)", px + 2, top + 40, 14, 3);
  rect(ctx, INK, px, top, 14, 40);
  for (let i = 0; i < 6; i++) {
    rect(ctx, "#1d2340", px + 1, top + 2 + i * 6, 12, 5);
    rect(ctx, "#2a3256", px + 1, top + 2 + i * 6, 12, 1);
  }
  rect(ctx, "#f38020", px + 2, top + 37, 10, 1);
}

function coffee(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE + 2;
  const top = o.y * TILE - 6;
  rect(ctx, INK, px, top, 12, 20);
  rect(ctx, "#8a8fa8", px + 1, top + 1, 10, 18);
  rect(ctx, INK, px + 3, top + 3, 6, 3);
  rect(ctx, GREEN, px + 4, top + 4, 1, 1);
  rect(ctx, INK, px + 3, top + 9, 6, 7);
  rect(ctx, WHITE, px + 4, top + 12, 4, 4);
  rect(ctx, "#6b3e1e", px + 5, top + 12, 2, 1);
}

function plant(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, "#2f8a55", px + 3, py - 4, 10, 8);
  rect(ctx, "#47b06f", px + 5, py - 6, 6, 6);
  rect(ctx, "#236b42", px + 2, py + 1, 3, 3);
  rect(ctx, "#236b42", px + 11, py + 1, 3, 3);
  rect(ctx, INK, px + 4, py + 6, 8, 9);
  rect(ctx, STEEL_LIGHT, px + 5, py + 7, 6, 7);
}

/** LeBronette at the front desk: long hair, a headset with a mic, and a purple-and-gold blazer. */
export const LEBRONETTE = [
  "...oooooo...",
  "..ohhhhhho..",
  ".ohhhhhhhho.",
  "bohhssssshob",
  "bohsesseshob",
  "gohsssssshob",
  ".gghsmmsshh.",
  ".ohhossoohho",
  "ohcccyycccho",
  "occcccycccco",
  "occcccccccco",
];
export const LEBRONETTE_COLOURS: Record<string, string> = {
  o: "#1a1420",
  h: "#3a2418",
  s: "#c68a5e",
  e: "#1a1420",
  m: "#c23b52",
  c: PURPLE,
  y: GOLD,
  b: "#141218",
  g: "#8d8a99",
};

function frontDesk(ctx: Ctx, o: TownObject) {
  const cx = (o.x + o.w / 2) * TILE;
  const deskTop = (o.y + 1) * TILE - 4;
  // LeBronette, seated behind the desk.
  bitmap(ctx, LEBRONETTE, cx - 6, deskTop - LEBRONETTE.length, LEBRONETTE_COLOURS);
  // Her chair back pokes out behind her.
  rect(ctx, INK, cx - 8, deskTop - 6, 2, 6);
  rect(ctx, INK, cx + 6, deskTop - 6, 2, 6);
  // The desk, with her monitor (seen from behind) and the name plate on the front.
  const x = o.x * TILE - 2;
  const w = o.w * TILE + 4;
  rect(ctx, "rgba(0,0,0,0.35)", x + 2, deskTop + 20, w, 3);
  rect(ctx, INK, x, deskTop, w, 20);
  rect(ctx, STEEL_LIGHT, x + 1, deskTop + 1, w - 2, 3);
  rect(ctx, STEEL, x + 1, deskTop + 4, w - 2, 15);
  rect(ctx, INK, x + 4, deskTop - 9, 10, 9);
  rect(ctx, STEEL_DARK, x + 5, deskTop - 8, 8, 7);
  rect(ctx, INK, x + w - 12, deskTop - 3, 8, 3);
  const name = "LEBRONETTE";
  rect(ctx, INK, cx - textWidth(name) / 2 - 2, deskTop + 7, textWidth(name) + 4, 9);
  text(ctx, name, Math.round(cx - textWidth(name) / 2), deskTop + 9, GOLD);
}

function exitMat(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, FLOOR, px, py, TILE, TILE);
  rect(ctx, "#0a3a48", px + 1, py + 1, 14, 13);
  rect(ctx, "#0f5266", px + 2, py + 2, 12, 11);
  for (let i = 0; i < 4; i++) {
    rect(ctx, CYAN, px + 4 + i, py + 4 + i, 1, 2);
    rect(ctx, CYAN, px + 11 - i, py + 4 + i, 1, 2);
  }
}

/** Bake the whole room into one canvas, like the town. */
export function bakeDev(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext("2d")!;
  for (let ty = 2; ty < ROWS - 1; ty++) for (let tx = 1; tx < COLS - 1; tx++) floorTile(ctx, tx, ty);
  walls(ctx);
  screenGlow(ctx);
  viewscreen(ctx);
  clockBox(ctx);
  telemetryWall(ctx);
  for (const o of DEV_OBJECTS) {
    if (o.style === "radar") radarConsole(ctx, o);
    else if (o.style === "console-wasm") flightConsole(ctx, o, "wasm");
    else if (o.style === "console-edge") flightConsole(ctx, o, "edge");
    else if (o.style === "console-static") flightConsole(ctx, o, "static");
    else if (o.style === "whiteboard") whiteboard(ctx, o);
    else if (o.style === "rack") rack(ctx, o);
    else if (o.style === "coffee") coffee(ctx, o);
    else if (o.style === "plant") plant(ctx, o);
    else if (o.style === "lebronette") frontDesk(ctx, o);
    else if (o.style === "exit") exitMat(ctx, o);
  }
  return canvas;
}

// ───────────────────────────── live layer ─────────────────────────────

/** The viewscreen: one timeline entry at a time, with its tick lit on the axis below. */
function drawTimeline(ctx: Ctx, now: number) {
  const { x, y, w, h } = VIEW;
  rect(ctx, SCREEN, x, y, w, h);
  text(ctx, "MISSION LOG", x + 3, y + 3, CYAN_DIM);
  const items = feed.timeline;
  const i = timelineIndex(now, items.length);
  if (i < 0) {
    text(ctx, "STANDBY", x + 3, y + 10, Math.floor(now / 600) % 2 ? CYAN : CYAN_DIM);
    return;
  }
  const item = items[i]!;
  const count = `${String(i + 1).padStart(2, "0")}/${String(items.length).padStart(2, "0")}`;
  text(ctx, count, x + w - textWidth(count) - 3, y + 3, CYAN_DIM);
  text(ctx, item.label.slice(0, 18), x + 3, y + 10, item.kind === "role" ? AMBER : CYAN);
  text(ctx, item.year, x + w - textWidth(item.year) - 3, y + 10, WHITE);
  // The axis, with a tick per entry placed by date.
  const ax = x + 4;
  const aw = w - 8;
  const ay = y + 19;
  rect(ctx, CYAN_DIM, ax, ay, aw, 1);
  const t0 = items[0]!.t;
  const span = Math.max(1, items.at(-1)!.t - t0);
  items.forEach((it, k) => {
    const tx = ax + Math.round(((it.t - t0) / span) * (aw - 1));
    const on = k === i;
    rect(ctx, on ? WHITE : it.kind === "role" ? "#8a6a2a" : CYAN_DIM, tx, ay - (on ? 3 : 1), 1, on ? 4 : 2);
  });
}

function drawRadar(ctx: Ctx, now: number) {
  const { cx, cy, r } = RADAR;
  disc(ctx, SCREEN, cx, cy, r);
  // Range rings and crosshair.
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    rect(ctx, "#0b3240", cx + Math.round(Math.cos(t) * (r / 2)), cy + Math.round(Math.sin(t) * (r / 2)), 1, 1);
  }
  rect(ctx, "#0b3240", cx - r, cy, r * 2 + 1, 1);
  rect(ctx, "#0b3240", cx, cy - r, 1, r * 2 + 1);
  const sweep = ((now / 8000) % 1) * Math.PI * 2;
  for (let k = 0; k <= r; k++) rect(ctx, GREEN, cx + Math.round(Math.cos(sweep) * k), cy + Math.round(Math.sin(sweep) * k), 1, 1);
  for (const b of feed.blips) {
    const bx = cx + Math.round(Math.cos(b.a) * b.r * (r - 1));
    const by = cy + Math.round(Math.sin(b.a) * b.r * (r - 1));
    // Blips flare as the sweep passes over them.
    const behind = (sweep - b.a + Math.PI * 4) % (Math.PI * 2);
    rect(ctx, behind < 1.6 ? b.hex : "#1e5a52", bx, by, 1, 1);
  }
}

function drawTelemetry(ctx: Ctx, now: number) {
  const { x, y, w, h } = TELE;
  rect(ctx, SCREEN, x + 1, y + 2, w - 2, 23);
  rect(ctx, SCREEN, x + 1, y + 27, w - 2, 9);
  rect(ctx, SCREEN, x + 12, y + 38, w - 13, h - 40);
  // Contribution heatmap: the last 10 weeks as LEDs, a column per week.
  const levels = ["#0d2a22", "#1b6b45", "#2fa765", "#5fe08e", "#b6ffcf"];
  const heat = feed.heat;
  const weeks = 10;
  for (let c = 0; c < weeks; c++)
    for (let d = 0; d < 7; d++) {
      const idx = heat ? heat.length - (weeks - c) * 7 + d : -1;
      const lv = heat && idx >= 0 ? heat[idx]! : Math.floor(rand(c, d, Math.floor(now / 4000)) * 2);
      rect(ctx, levels[lv] ?? levels[0]!, x + 2 + c * 3, y + 3 + d * 3, 2, 2);
    }
  // Streak, in days.
  const streak = feed.streak === null ? "--" : `${feed.streak}D`;
  text(ctx, streak, x + Math.round((w - textWidth(streak)) / 2), y + 29, Math.floor(now / 1000) % 2 || feed.streak === null ? GREEN : "#3fbf7a");
  // LeetCode: easy, medium and hard as three bar gauges.
  const lc = feed.leet;
  const bars: [number, string][] = lc
    ? [
        [lc.easy / Math.max(1, lc.totals.easy), "#00b8a3"],
        [lc.medium / Math.max(1, lc.totals.medium), "#ffc01e"],
        [lc.hard / Math.max(1, lc.totals.hard), "#ff375f"],
      ]
    : [
        [0, "#00b8a3"],
        [0, "#ffc01e"],
        [0, "#ff375f"],
      ];
  const gh = 12;
  bars.forEach(([v, c], k) => {
    const bx = x + 12 + k * 6;
    const by = y + 39;
    rect(ctx, "#10213a", bx, by, 4, gh);
    // Scaled up so a handful of hards still shows; capped at full.
    const fill = Math.max(lc ? 1 : 0, Math.min(gh, Math.round(Math.sqrt(v) * gh)));
    rect(ctx, c, bx, by + gh - fill, 4, fill);
  });
}

function drawRack(ctx: Ctx, now: number) {
  const o = DEV_OBJECTS.find((d) => d.id === "rack")!;
  const px = o.x * TILE + 1;
  const top = o.y * TILE - 8;
  const tick = Math.floor(now / 700);
  for (let i = 0; i < 6; i++)
    for (let k = 0; k < 3; k++) rect(ctx, rand(i, k, tick) < 0.55 ? (k === 2 ? AMBER : GREEN) : "#0e1a14", px + 3 + k * 3, top + 4 + i * 6, 1, 1);
}

function drawClock(ctx: Ctx) {
  const { h, m } = easternTime();
  const s = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  rect(ctx, SCREEN, CLOCK.x, CLOCK.y, CLOCK.w, CLOCK.h);
  text(ctx, s, CLOCK.x + Math.round((CLOCK.w - textWidth(s)) / 2), CLOCK.y + 3, RED);
}

/** Her headset's mic light: on air. */
function drawHeadset(ctx: Ctx, now: number) {
  const o = DEV_OBJECTS.find((d) => d.id === "lebronette")!;
  const cx = (o.x + o.w / 2) * TILE;
  const deskTop = (o.y + 1) * TILE - 4;
  rect(ctx, Math.floor(now / 900) % 2 ? RED : "#5a1a22", cx - 5, deskTop - LEBRONETTE.length + 6, 1, 1);
}

/** Drawn every frame beneath the visitor: the screens, the radar sweep, and blinking lights. */
export function drawDevLive(ctx: Ctx, _player: Point) {
  const now = Date.now();
  drawTimeline(ctx, now);
  drawRadar(ctx, now);
  drawTelemetry(ctx, now);
  drawRack(ctx, now);
  drawClock(ctx);
  drawHeadset(ctx, now);
}
