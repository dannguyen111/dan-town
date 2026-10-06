/**
 * The inside of Home: a Hanoi tube house (nhà ống), two rooms deep. The living room at the back
 * has the TV, the flags, the fridge and the twin on the couch; the front room has the desk, the bookshelf of
 * papers, a tea table, and a motorbike parked indoors, as is tradition.
 *
 * The wall clock and the view out the window follow Dan's time zone (US Eastern).
 *
 * Ground legend:  # wall (solid) · . floor
 */
import { TILE, type Point, type TownObject } from "./map.ts";
import { TWIN_PALETTE, cellColour, compose } from "./sprites.ts";

export const HOME_GROUND = [
  "###############", // 0  back wall (flags, clock, window)
  "###############", // 1
  "#.............#", // 2  living room (wood floor)
  "#.............#", // 3
  "#.............#", // 4
  "#.............#", // 5
  "#.............#", // 6
  "#.............#", // 7
  "#.............#", // 8
  "#######.#######", // 9  partition wall with a doorway
  "#######.#######", // 10
  "#.............#", // 11 front room (patterned cement tiles)
  "#.............#", // 12
  "#.............#", // 13
  "#.............#", // 14
  "#.............#", // 15
  "#.............#", // 16
  "#.............#", // 17
  "#######.#######", // 18 front wall, exit mat in the gap
] as const;

const COLS = HOME_GROUND[0].length;
const ROWS = HOME_GROUND.length;

const note = (text: string) => ({ type: "note", text }) as const;
const paper = (href: string, text: string) => ({ type: "url", href, text, cta: "Read the paper ↗" }) as const;
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

export const HOME_OBJECTS: readonly TownObject[] = [
  // ── Living room ──
  {
    id: "fridge",
    kind: "prop",
    x: 1,
    y: 2,
    w: 1,
    h: 2,
    target: { type: "event", name: "fridge" },
    label: "Fridge",
    style: "fridge",
    labelLift: 10,
    hint: "Leave Dan a note 📌",
  },
  prop("vn-flag", "Vietnamese flag", 2, 1, 2, 1, "The red flag with the golden star. Dan is from Hanoi, Vietnam."),
  { id: "clock", kind: "prop", x: 4, y: 1, w: 1, h: 1, target: { type: "event", name: "clock" }, label: "Clock", style: "clock", hideLabel: true },
  {
    id: "tv",
    kind: "prop",
    x: 6,
    y: 2,
    w: 3,
    h: 1,
    target: { type: "event", name: "tv" },
    label: "TV",
    style: "tv",
    labelLift: 30,
    hint: "Turn on the TV ▶",
  },
  prop("sigma-chi", "Sigma Chi flag", 10, 1, 2, 1, "Sigma Chi, Theta Chapter at Gettysburg College. Dan was a brother and served as chapter president. In hoc signo vinces."),
  prop("window", "Window", 12, 1, 2, 1, "Rooftops of Hanoi's Old Quarter. The sky outside follows Dan's clock (Eastern Time)."),
  prop("couch-l", "Couch", 5, 6, 2, 1, "A comfy couch. The twin has claimed the middle seat."),
  // Drawn sitting on the couch by this file's live layer, not as the town's standing twin.
  { id: "twin", kind: "npc", x: 7, y: 6, w: 1, h: 1, target: { type: "place", id: "twin" }, label: "Digital Twin", style: "twin-couch", labelLift: 16 },
  prop("couch-r", "Couch", 8, 6, 2, 1, "A comfy couch. The twin has claimed the middle seat."),
  prop("phin", "Coffee", 10, 6, 1, 1, "Vietnamese iced coffee, dripping through a phin filter. Slow brew, strong result."),
  prop("palm", "Plant", 1, 8, 1, 1, "An areca palm. It has watched a lot of basketball."),
  prop("bamboo", "Plant", 13, 8, 1, 1, "Lucky bamboo. Good for the house, and for passing exams."),

  // ── Front room ──
  {
    ...prop("desk", "AI Desk", 1, 11, 2, 1, "$ tail -f pipeline.log\n> 30,000+ complaints/yr scored by LLMs\n> prompt caching: compute -50%\n> JSON output contracts: cost -70%\n> status: shipping"),
    hideLabel: false,
    labelLift: 24,
  },
  prop("hornets", "Charlotte Hornets flag", 4, 10, 2, 1, "Charlotte Hornets flag... He must be depressed..."),
  {
    ...prop("book-stpete", "Saint Petersburg AI Agent", 11, 11, 1, 1, ""),
    target: paper("/docs/cs391-final-report.pdf", "An MCTS agent with learned evaluation that won 1st place in a class tournament."),
  },
  {
    ...prop("book-chomp", "3xN Chomp (Senior Capstone)", 12, 11, 1, 1, ""),
    target: paper("/docs/capstone_paper_final.pdf", "Proving infinite families of losing positions in 3-row Chomp."),
  },
  {
    ...prop("book-health", "Healthcare Access Disparities", 13, 11, 1, 1, ""),
    target: paper("/docs/Completed-Study-Paper.pdf", "Quantifying healthcare inequity across Pennsylvania counties."),
  },
  prop(
    "trophies",
    "Trophy cabinet",
    13,
    13,
    1,
    2,
    "7th of 547 in the class, GPA 4.08. Summa Cum Laude, Phi Beta Kappa, and the Earl E. Ziegler Mathematics Award.",
  ),
  prop("tea", "Tea table", 9, 14, 2, 1, "A low tea table with tiny plastic stools. The best conversations in Hanoi happen a foot off the ground."),
  prop("motorbike", "Motorbike", 1, 15, 2, 1, "A motorbike, parked in the house overnight like in every Hanoi tube house."),
  prop("plant-door", "Plant", 13, 17, 1, 1, "A potted plant by the door. Shoes off, please."),
  { id: "exit", kind: "exit", x: 7, y: 18, w: 1, h: 1, door: { x: 7, y: 18 }, target: { type: "place", id: "town" }, label: "Exit", style: "exit", hideLabel: true },
];

export const HOME_SPAWN: Point = { x: 7, y: 17 };

// ───────────────────────────── Eastern Time ─────────────────────────────

const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23" });

/** Hours (0–23) and minutes in Dan's time zone, whatever the visitor's own clock says. */
export function easternTime(now = new Date()) {
  const parts = ET.formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { h: get("hour") % 24, m: get("minute") };
}

/** e.g. "7:42 PM". */
export function formatEastern(now = new Date()) {
  const { h, m } = easternTime(now);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

type Sky = "night" | "dawn" | "day" | "dusk";
const skyAt = (t: number): Sky => (t < 5 || t >= 20 ? "night" : t < 7 ? "dawn" : t < 17 ? "day" : "dusk");

// ───────────────────────────── art ─────────────────────────────

const INK = "#2b1d14";
const OCHRE = "#e9b949"; // Hanoi's yellow plaster
const OCHRE_SHADE = "#d6a63c";
const BEAM = "#5e3a22";
const BEAM_DARK = "#432817";
const BEAM_LIGHT = "#7a4d2e";
const WOOD = "#b0703f";
const WOOD_DARK = "#965a30";
const WOOD_LIGHT = "#c4844f";
const TILE_BASE = "#efe3c8";
const TILE_GROUT = "#d8c9a8";
const TILE_RED = "#c9786a";
const TILE_TEAL = "#6aa89f";
const RED = "#da251d";
const GOLD = "#e0b040";
const WHITE = "#fffaf0";
const COUCH = "#2e6b5a";
const COUCH_LIGHT = "#3f8a74";
const COUCH_DARK = "#22503f";

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

/** Draw a text bitmap: each non-"." letter is looked up in `colors`. */
function bitmap(ctx: Ctx, rows: readonly string[], x: number, y: number, colors: Record<string, string>) {
  rows.forEach((row, ry) => [...row].forEach((c, rx) => colors[c] && rect(ctx, colors[c]!, x + rx, y + ry, 1, 1)));
}

function woodFloor(ctx: Ctx, tx: number, ty: number) {
  const px = tx * TILE;
  const py = ty * TILE;
  rect(ctx, WOOD, px, py, TILE, TILE);
  for (let r = 0; r < 4; r++) {
    const y = py + r * 4;
    rect(ctx, WOOD_DARK, px, y + 3, TILE, 1);
    rect(ctx, WOOD_DARK, px + Math.floor(rand(tx, ty, r) * 15), y, 1, 3);
    if (rand(tx, ty, r + 9) < 0.5) rect(ctx, WOOD_LIGHT, px + Math.floor(rand(tx, ty, r + 4) * 12), y + 1, 3, 1);
  }
}

/** Gạch bông: patterned cement tiles. Corners of neighbouring tiles join into little flowers. */
function cementTile(ctx: Ctx, tx: number, ty: number) {
  const px = tx * TILE;
  const py = ty * TILE;
  rect(ctx, TILE_BASE, px, py, TILE, TILE);
  for (let dy = -2; dy <= 2; dy++) {
    const w = 3 - Math.abs(dy);
    rect(ctx, TILE_TEAL, px + 8 - w, py + 8 + dy, w * 2, 1);
  }
  rect(ctx, TILE_RED, px + 7, py + 7, 2, 2);
  for (const [cx, cy] of [
    [px, py],
    [px + 13, py],
    [px, py + 13],
    [px + 13, py + 13],
  ] as const) {
    rect(ctx, TILE_RED, cx, cy, 3, 3);
  }
  rect(ctx, TILE_TEAL, px + 7, py, 2, 1);
  rect(ctx, TILE_TEAL, px + 7, py + 15, 2, 1);
  rect(ctx, TILE_TEAL, px, py + 7, 1, 2);
  rect(ctx, TILE_TEAL, px + 15, py + 7, 1, 2);
  rect(ctx, TILE_GROUT, px + 15, py, 1, TILE);
  rect(ctx, TILE_GROUT, px, py + 15, TILE, 1);
}

/** A two-tile-tall wall face: ochre plaster under a ceiling beam, with a wooden skirting board. */
function wallFace(ctx: Ctx, x: number, y: number, w: number) {
  rect(ctx, OCHRE, x, y, w, 2 * TILE);
  for (let i = 0; i < w / 3; i++) {
    const sx = x + Math.floor(rand(i, y, 1) * w);
    const sy = y + 5 + Math.floor(rand(i, y, 2) * 20);
    rect(ctx, OCHRE_SHADE, sx, sy, 1 + Math.floor(rand(i, y, 3) * 2), 1);
  }
  rect(ctx, BEAM, x, y, w, 4);
  rect(ctx, BEAM_DARK, x, y + 4, w, 1);
  rect(ctx, BEAM, x, y + 28, w, 4);
  rect(ctx, BEAM_LIGHT, x, y + 28, w, 1);
}

function walls(ctx: Ctx) {
  const W = COLS * TILE;
  wallFace(ctx, 0, 0, W);

  // Partition between the two rooms, with a wooden door frame and red couplets beside it.
  const doorX = 7 * TILE;
  const py = 9 * TILE;
  wallFace(ctx, 0, py, doorX);
  wallFace(ctx, doorX + TILE, py, W - doorX - TILE);
  for (let ty = 9; ty <= 10; ty++) woodFloor(ctx, 7, ty);
  rect(ctx, BEAM_DARK, doorX - 2, py, 2, 2 * TILE);
  rect(ctx, BEAM_DARK, doorX + TILE, py, 2, 2 * TILE);
  doorLintel(ctx);
  for (const cx of [doorX - 11, doorX + TILE + 5]) {
    rect(ctx, "#a8231c", cx, py + 7, 6, 19);
    rect(ctx, "#c8322b", cx + 1, py + 8, 4, 17);
    for (let i = 0; i < 4; i++) rect(ctx, GOLD, cx + 2, py + 10 + i * 4, 2, 2);
  }

  // Side walls (seen from above) and the front wall.
  for (let ty = 2; ty < ROWS - 1; ty++) {
    if (ty === 9 || ty === 10) continue;
    rect(ctx, BEAM, 0, ty * TILE, TILE, TILE);
    rect(ctx, BEAM, W - TILE, ty * TILE, TILE, TILE);
  }
  rect(ctx, BEAM_LIGHT, TILE - 1, 2 * TILE, 1, 7 * TILE);
  rect(ctx, BEAM_LIGHT, W - TILE, 2 * TILE, 1, 7 * TILE);
  rect(ctx, BEAM_LIGHT, TILE - 1, 11 * TILE, 1, 7 * TILE);
  rect(ctx, BEAM_LIGHT, W - TILE, 11 * TILE, 1, 7 * TILE);
  const fy = (ROWS - 1) * TILE;
  rect(ctx, BEAM, 0, fy, W, TILE);
  rect(ctx, BEAM_LIGHT, 0, fy, W, 1);
}

/**
 * The beam across the top of the doorway between the rooms. It is also drawn over the visitor
 * (drawHomeOver), so they walk under it. Only someone standing in the doorway reaches it, so
 * drawing it on top is safe everywhere else.
 */
function doorLintel(ctx: Ctx) {
  rect(ctx, BEAM, 7 * TILE - 2, 9 * TILE, TILE + 4, 4);
}

function rug(ctx: Ctx) {
  const x = 4 * TILE + 4;
  const y = 3 * TILE + 2;
  const w = 7 * TILE - 8;
  const h = 3 * TILE - 6;
  rect(ctx, GOLD, x, y, w, h);
  rect(ctx, "#a8322d", x + 2, y + 2, w - 4, h - 4);
  rect(ctx, "#c4473d", x + 6, y + 6, w - 12, h - 12);
  for (let i = x + 4; i < x + w - 4; i += 6) {
    rect(ctx, GOLD, i, y + 3, 2, 1);
    rect(ctx, GOLD, i, y + h - 4, 2, 1);
  }
}

/** A flag hanging from a rod on the wall. `y` is the top of the wall face it hangs on. */
function hangingFlag(ctx: Ctx, o: TownObject, wallTop: number, paint: (x: number, y: number, w: number, h: number) => void) {
  const x = o.x * TILE + 2;
  const y = wallTop + 7;
  const w = 28;
  const h = 19;
  rect(ctx, INK, x - 2, y - 2, w + 4, 2);
  rect(ctx, GOLD, x - 3, y - 2, 1, 2);
  rect(ctx, GOLD, x + w + 2, y - 2, 1, 2);
  rect(ctx, "rgba(0,0,0,0.18)", x + 1, y + 1, w, h);
  paint(x, y, w, h);
}

const STAR = ["....#....", "....#....", "...###...", "#########", ".#######.", "..#####..", "..##.##..", ".##...##.", ".#.....#."];

function vnFlag(ctx: Ctx, o: TownObject) {
  hangingFlag(ctx, o, 0, (x, y, w, h) => {
    rect(ctx, RED, x, y, w, h);
    rect(ctx, "#b81d16", x, y + h - 1, w, 1);
    bitmap(ctx, STAR, x + 10, y + 5, { "#": "#ffde00" });
  });
}

/** Draw a bitmap with a 1px dark outline around its "#" pixels, like stitched felt letters. */
function outlined(ctx: Ctx, rows: readonly string[], x: number, y: number, fill: string, edge: string) {
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const)
    bitmap(ctx, rows, x + dx, y + dy, { "#": edge });
  bitmap(ctx, rows, x, y, { "#": fill });
}

const SIGMA = ["#######", "##....#", ".##....", "..##...", "...##..", "..##...", ".##....", "##....#", "#######"];
const CHI = ["##...##", "##...##", ".##.##.", "..###..", "..###..", "..###..", ".##.##.", "##...##", "##...##"];

/** The fraternity's letters in old gold on Sigma Chi blue. */
function sigmaChiFlag(ctx: Ctx, o: TownObject) {
  hangingFlag(ctx, o, 0, (x, y, w, h) => {
    rect(ctx, "#0b4f8a", x, y, w, h);
    rect(ctx, "#fed141", x, y + h - 2, w, 1);
    rect(ctx, "#ffffff", x, y + h - 1, w, 1);
    outlined(ctx, SIGMA, x + 5, y + 4, "#fed141", "#06233f");
    outlined(ctx, CHI, x + 16, y + 4, "#fed141", "#06233f");
  });
}

/**
 * A pixel take on the Hornets' logo: a teal-and-purple hornet with white wings spread, raised
 * antennae, and a basketball for a body, ending in a stinger.
 */
const HORNETS_LOGO = [
  "......k.....k......",
  ".......k...k.......",
  "www.....kkk.....www",
  ".wwww..ktttk..wwww.",
  "..wwwwkektkekwwww..",
  "...wwwkptttpkwww...",
  "....wwkkpppkkww....",
  ".....koooooook.....",
  "....koooolooook....",
  "....klllllllllk....",
  "....koooolooook....",
  ".....koooloook.....",
  "......kkkkkkk......",
  "........ktk........",
  ".........k.........",
];

function hornetsFlag(ctx: Ctx, o: TownObject) {
  hangingFlag(ctx, o, 9 * TILE, (x, y, w, h) => {
    rect(ctx, "#1d1160", x, y, w, h);
    rect(ctx, "#00788c", x, y, w, 2);
    rect(ctx, "#00788c", x, y + h - 2, w, 2);
    bitmap(ctx, HORNETS_LOGO, x + 5, y + 2, {
      w: "#ffffff",
      k: "#0d0a1f",
      t: "#00a3ad",
      p: "#6a5acd",
      e: "#ffffff",
      o: "#f28c28",
      l: "#8a3c10",
    });
  });
}

const CLOCK = { x: 4 * TILE + 8, y: 15 };

function clockFace(ctx: Ctx) {
  for (let dy = -7; dy <= 7; dy++)
    for (let dx = -7; dx <= 7; dx++) {
      const d = dx * dx + dy * dy;
      if (d > 50) continue;
      rect(ctx, d > 37 ? INK : d > 26 ? BEAM_LIGHT : WHITE, CLOCK.x + dx, CLOCK.y + dy, 1, 1);
    }
  for (const [dx, dy] of [
    [0, -4],
    [4, 0],
    [0, 4],
    [-4, 0],
  ] as const)
    rect(ctx, INK, CLOCK.x + dx, CLOCK.y + dy, 1, 1);
}

const WIN = { x: 198, y: 7, w: 20, h: 16 };

function windowFrame(ctx: Ctx) {
  rect(ctx, BEAM_DARK, WIN.x - 2, WIN.y - 2, WIN.w + 4, WIN.h + 4);
  // Green louvred shutters, flung open.
  for (const sx of [WIN.x - 8, WIN.x + WIN.w + 2]) {
    rect(ctx, "#24533d", sx, WIN.y - 2, 6, WIN.h + 4);
    for (let y = WIN.y; y < WIN.y + WIN.h; y += 2) rect(ctx, "#3f8a64", sx + 1, y, 4, 1);
  }
  // Sill with two little pots.
  rect(ctx, BEAM_LIGHT, WIN.x - 4, WIN.y + WIN.h + 2, WIN.w + 8, 2);
  for (const px of [WIN.x + 1, WIN.x + WIN.w - 5]) {
    rect(ctx, "#4f9d4a", px, WIN.y + WIN.h - 1, 4, 2);
    rect(ctx, TILE_RED, px, WIN.y + WIN.h + 1, 4, 1);
  }
}

const LANTERNS = [5 * TILE + 6, 9 * TILE + 2];

function lanterns(ctx: Ctx) {
  for (const cx of LANTERNS) {
    rect(ctx, INK, cx, 4, 1, 4);
    rect(ctx, GOLD, cx - 2, 8, 5, 1);
    rect(ctx, "#c8322b", cx - 4, 9, 9, 7);
    rect(ctx, "#c8322b", cx - 3, 8, 7, 9);
    rect(ctx, "#e85a3c", cx - 2, 9, 2, 7);
    rect(ctx, "#a8231c", cx + 2, 9, 1, 7);
    rect(ctx, GOLD, cx - 2, 17, 5, 1);
    rect(ctx, GOLD, cx, 18, 1, 4);
  }
}

const MINT = "#9fd3c7";
const MINT_SHADE = "#7fb8ab";
const MINT_LIGHT = "#d4f0e8";

/** A retro mint fridge in the corner, covered in notes and magnets. Visitors pin theirs here. */
function fridge(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE - 8; // pokes up against the back wall
  const h = o.h * TILE + 6;
  rect(ctx, "rgba(0,0,0,0.3)", x + 2, y + h, 14, 2);
  rect(ctx, INK, x + 1, y, 14, h);
  rect(ctx, MINT, x + 2, y + 1, 12, h - 2);
  rect(ctx, MINT_LIGHT, x + 2, y + 1, 1, h - 2);
  rect(ctx, MINT_SHADE, x + 13, y + 1, 1, h - 2);
  // Freezer door, and the handles
  rect(ctx, INK, x + 2, y + 11, 12, 1);
  rect(ctx, "#c0c6cc", x + 11, y + 4, 1, 5);
  rect(ctx, "#c0c6cc", x + 11, y + 14, 1, 7);
  // Notes held up by little magnets
  for (const [dx, dy, paper, magnet] of [
    [3, 3, "#fff6b8", RED],
    [4, 15, "#ffd1dc", GOLD],
    [7, 22, "#cfe8ff", TILE_TEAL],
    [3, 28, "#fff6b8", "#2f6db5"],
  ] as const) {
    rect(ctx, paper, x + dx, y + dy, 5, 5);
    rect(ctx, MINT_SHADE, x + dx + 1, y + dy + 2, 3, 1);
    rect(ctx, magnet, x + dx + 2, y + dy, 1, 1);
  }
}

/** A CRT on a low wooden cabinet, with rabbit ears. The screen invites you to press play. */
function tv(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  // Cabinet
  rect(ctx, "rgba(0,0,0,0.3)", x + 3, y + 14, 44, 3);
  rect(ctx, INK, x + 1, y + 1, 46, 15);
  rect(ctx, WOOD, x + 2, y + 2, 44, 12);
  rect(ctx, WOOD_DARK, x + 2, y + 8, 44, 1);
  rect(ctx, WOOD_DARK, x + 23, y + 2, 1, 12);
  rect(ctx, GOLD, x + 20, y + 5, 2, 1);
  rect(ctx, GOLD, x + 26, y + 5, 2, 1);
  rect(ctx, GOLD, x + 20, y + 11, 2, 1);
  rect(ctx, GOLD, x + 26, y + 11, 2, 1);
  // Set
  const tx = x + 8;
  const ty = y - 20;
  rect(ctx, INK, tx, ty, 32, 22);
  rect(ctx, "#cfc6b4", tx + 1, ty + 1, 30, 20);
  rect(ctx, INK, tx + 3, ty + 3, 20, 16);
  rect(ctx, "#22303f", tx + 4, ty + 4, 18, 14);
  rect(ctx, "#3d5266", tx + 5, ty + 5, 3, 1);
  rect(ctx, "#3d5266", tx + 5, ty + 6, 1, 2);
  for (let r = -3; r <= 3; r++) rect(ctx, "#ffffff", tx + 11, ty + 11 + r, 4 - Math.abs(r), 1);
  rect(ctx, INK, tx + 25, ty + 4, 3, 3);
  rect(ctx, GOLD, tx + 26, ty + 5, 1, 1);
  rect(ctx, INK, tx + 25, ty + 9, 3, 3);
  rect(ctx, GOLD, tx + 26, ty + 10, 1, 1);
  for (let i = 0; i < 3; i++) rect(ctx, "#9a917f", tx + 24, ty + 14 + i * 2, 5, 1);
  // Rabbit ears
  const ax = tx + 16;
  rect(ctx, INK, ax - 3, ty - 2, 6, 2);
  for (let i = 1; i <= 9; i++) {
    rect(ctx, INK, ax - 2 - i, ty - 2 - i, 1, 1);
    rect(ctx, INK, ax + 1 + i, ty - 2 - i, 1, 1);
  }
  rect(ctx, "#c0c6cc", ax - 12, ty - 12, 2, 2);
  rect(ctx, "#c0c6cc", ax + 10, ty - 12, 2, 2);
}

const COUCH_X = 5 * TILE + 1;
const COUCH_W = 5 * TILE - 2;
const COUCH_Y = 6 * TILE;

/**
 * The couch faces the TV, so we see its back: a tall backrest between two rolled arms. The
 * backrest is redrawn over the twin (see drawHomeLive) so they sit in it rather than stand on it.
 */
function couchBack(ctx: Ctx) {
  const x = COUCH_X + 4;
  const w = COUCH_W - 8;
  rect(ctx, INK, x, COUCH_Y - 1, w, 15);
  rect(ctx, COUCH, x + 1, COUCH_Y, w - 2, 13);
  rect(ctx, COUCH_LIGHT, x + 1, COUCH_Y, w - 2, 2);
  rect(ctx, COUCH_DARK, x + 1, COUCH_Y + 12, w - 2, 1);
  // Three cushions, buttoned
  for (const i of [1, 2]) rect(ctx, COUCH_DARK, x + Math.round((w * i) / 3), COUCH_Y + 2, 1, 10);
  for (let i = 0; i < 3; i++) rect(ctx, COUCH_DARK, x + Math.round((w * (i + 0.5)) / 3), COUCH_Y + 6, 1, 1);
  rect(ctx, INK, x + 4, COUCH_Y + 14, 2, 2);
  rect(ctx, INK, x + w - 6, COUCH_Y + 14, 2, 2);
  // Rolled arms
  for (const ax of [COUCH_X, COUCH_X + COUCH_W - 8]) {
    rect(ctx, INK, ax, COUCH_Y - 4, 8, 18);
    rect(ctx, COUCH_DARK, ax + 1, COUCH_Y - 3, 6, 16);
    rect(ctx, COUCH, ax + 1, COUCH_Y - 3, 6, 3);
    rect(ctx, COUCH_LIGHT, ax + 2, COUCH_Y - 3, 4, 1);
  }
}

function couch(ctx: Ctx) {
  rect(ctx, "rgba(0,0,0,0.3)", COUCH_X + 2, COUCH_Y + 13, COUCH_W, 3);
  // Throw pillows peeking over the backrest
  for (const [px, col] of [
    [COUCH_X + 12, "#c4473d"],
    [COUCH_X + COUCH_W - 20, GOLD],
  ] as const) {
    rect(ctx, INK, px, COUCH_Y - 5, 8, 6);
    rect(ctx, col, px + 1, COUCH_Y - 4, 6, 5);
  }
  couchBack(ctx);
}

const TWIN_X = 7 * TILE + 8; // centre of the twin's seat
const SHIRT = TWIN_PALETTE.c;

/**
 * The digital twin, seen from behind, sitting up on the couch watching TV: head and shoulders
 * above the backrest, forearms resting on top of it, headphones on.
 */
function seatedTwin(ctx: Ctx) {
  const top = COUCH_Y - 15;
  couch(ctx);
  // Head and shoulders from the twin's own "up" sprite, so it's recognisably the same character.
  compose("up", 0, true)
    .slice(0, 12)
    .forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const c = cellColour(TWIN_PALETTE, ch, y);
        if (c) rect(ctx, c, TWIN_X - 6 + x, top + y, 1, 1);
      }),
    );
  // The sprite's torso stops short of the backrest; carry the shirt down to meet it.
  rect(ctx, TWIN_PALETTE.o, TWIN_X - 6, top + 12, 12, COUCH_Y - 1 - (top + 12));
  rect(ctx, SHIRT, TWIN_X - 5, top + 12, 10, COUCH_Y - 1 - (top + 12));
  couchBack(ctx);
  // Forearms resting on the backrest
  for (const dir of [-1, 1]) {
    const x0 = dir < 0 ? TWIN_X - 11 : TWIN_X + 5;
    rect(ctx, TWIN_PALETTE.o, x0, COUCH_Y - 3, 7, 4);
    rect(ctx, SHIRT, dir < 0 ? x0 + 3 : x0 + 1, COUCH_Y - 2, 3, 2);
    rect(ctx, TWIN_PALETTE.s, dir < 0 ? x0 + 1 : x0 + 4, COUCH_Y - 2, 2, 2);
  }
  // "Talk to me" bubble, like the twin in town
  rect(ctx, INK, TWIN_X + 4, top - 11, 9, 8);
  rect(ctx, "#ffffff", TWIN_X + 5, top - 10, 7, 6);
  for (const dx of [6, 8, 10]) rect(ctx, "#2bb3a3", TWIN_X + dx, top - 8, 1, 1);
}

/** Side table with a cà phê sữa đá and a phin filter dripping into a cup. */
function phin(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  rect(ctx, "rgba(0,0,0,0.3)", x + 4, y + 14, 10, 2);
  rect(ctx, INK, x + 1, y + 2, 14, 3);
  rect(ctx, WOOD, x + 2, y + 2, 12, 2);
  rect(ctx, BEAM, x + 7, y + 5, 2, 9);
  rect(ctx, BEAM, x + 4, y + 13, 8, 2);
  // Iced coffee: coffee over condensed milk.
  rect(ctx, INK, x + 2, y - 7, 5, 9);
  rect(ctx, "#5a3420", x + 3, y - 6, 3, 4);
  rect(ctx, "#f2e6cc", x + 3, y - 2, 3, 3);
  rect(ctx, "#ffffff", x + 3, y - 6, 1, 1);
  // Phin on a cup
  rect(ctx, WHITE, x + 9, y - 2, 5, 4);
  rect(ctx, "#c0c6cc", x + 9, y - 7, 5, 5);
  rect(ctx, "#8a929a", x + 10, y - 8, 3, 1);
  rect(ctx, "#5a3420", x + 11, y - 2, 1, 1);
}

function palm(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  for (const [dx, dy, w] of [
    [1, -7, 5],
    [10, -7, 5],
    [3, -10, 4],
    [9, -10, 4],
    [6, -12, 4],
    [0, -3, 5],
    [11, -3, 5],
  ] as const)
    rect(ctx, dy < -8 ? "#6dbb5b" : "#4f9d4a", px + dx, py + dy, w, 3);
  rect(ctx, "#3a7a3a", px + 7, py - 9, 2, 12);
  pot(ctx, px, py);
}

function bamboo(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  for (const [dx, top] of [
    [5, -10],
    [8, -13],
    [11, -8],
  ] as const) {
    rect(ctx, "#7cb342", px + dx, py + top, 2, 14 - top - 10);
    for (let y = py + top + 3; y < py + 4; y += 4) rect(ctx, "#558b2f", px + dx, y, 2, 1);
    rect(ctx, "#8bc34a", px + dx + 2, py + top + 1, 3, 1);
  }
  pot(ctx, px, py);
}

function pot(ctx: Ctx, px: number, py: number) {
  rect(ctx, INK, px + 4, py + 4, 8, 10);
  rect(ctx, "#2f6db5", px + 5, py + 5, 6, 8);
  rect(ctx, WHITE, px + 5, py + 7, 6, 1);
  rect(ctx, WHITE, px + 7, py + 9, 2, 2);
}

/** Dan's AI desk: a terminal tailing an LLM pipeline's log. */
function desk(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  rect(ctx, "rgba(0,0,0,0.3)", x + 3, y + 14, 28, 2);
  rect(ctx, INK, x + 1, y - 4, 30, 5);
  rect(ctx, WOOD, x + 2, y - 4, 28, 3);
  rect(ctx, WOOD_DARK, x + 2, y - 1, 28, 1);
  rect(ctx, INK, x + 3, y + 1, 2, 14);
  rect(ctx, INK, x + 27, y + 1, 2, 14);
  rect(ctx, WOOD_DARK, x + 19, y + 1, 8, 6);
  rect(ctx, GOLD, x + 22, y + 3, 2, 1);
  // Monitor
  rect(ctx, INK, x + 5, y - 24, 22, 16);
  rect(ctx, "#0d1b14", x + 6, y - 23, 20, 13);
  for (const [dy, w, c] of [
    [1, 7, "#7dffb0"],
    [3, 14, "#59f0d0"],
    [5, 11, "#7dffb0"],
    [7, 13, "#ffd166"],
    [9, 4, "#7dffb0"],
  ] as const)
    rect(ctx, c, x + 8, y - 23 + dy, w, 1);
  rect(ctx, "#ffffff", x + 13, y - 14, 2, 1);
  rect(ctx, INK, x + 15, y - 8, 2, 4);
  rect(ctx, INK, x + 12, y - 5, 8, 1);
  // Keyboard and a mug
  rect(ctx, "#d5dde8", x + 8, y - 4, 12, 1);
  rect(ctx, WHITE, x + 24, y - 7, 3, 3);
  rect(ctx, "#c4605a", x + 24, y - 6, 3, 1);
  // A tiny robot sticker on the bezel
  rect(ctx, "#d5dde8", x + 23, y - 22, 2, 2);
  rect(ctx, "#7df9ff", x + 23, y - 22, 1, 1);
}

/** Framed photos on the front room wall: decoration only. */
function photos(ctx: Ctx) {
  const x = 9 * TILE;
  const y = 9 * TILE;
  // Runway show
  rect(ctx, GOLD, x + 1, y + 7, 12, 10);
  rect(ctx, "#ffe3ef", x + 2, y + 8, 10, 8);
  rect(ctx, "#d1497a", x + 2, y + 13, 10, 3);
  rect(ctx, "#2b2233", x + 6, y + 9, 2, 5);
  rect(ctx, "#efc19c", x + 6, y + 9, 2, 1);
  // Portrait
  rect(ctx, INK, x + 15, y + 6, 8, 12);
  rect(ctx, "#bfe6ff", x + 16, y + 7, 6, 10);
  rect(ctx, "#efc19c", x + 18, y + 9, 2, 2);
  rect(ctx, "#1f1a24", x + 18, y + 8, 2, 1);
  rect(ctx, "#2b2233", x + 17, y + 11, 4, 6);
  // Vintage market
  rect(ctx, INK, x + 24, y + 11, 8, 8);
  rect(ctx, "#ffd166", x + 25, y + 12, 6, 6);
  rect(ctx, "#4f9d4a", x + 25, y + 16, 6, 2);
  rect(ctx, "#ff7a59", x + 26, y + 14, 1, 2);
  rect(ctx, "#2f7f7a", x + 29, y + 14, 1, 2);
}

/** One bookshelf across three tiles. The books with gold labels are the papers. */
function bookshelf(ctx: Ctx, books: TownObject[]) {
  const x = Math.min(...books.map((b) => b.x)) * TILE;
  const y = books[0]!.y * TILE;
  const w = books.length * TILE;
  rect(ctx, INK, x + 1, y - 26, w - 2, 42);
  rect(ctx, BEAM, x + 2, y - 25, w - 4, 40);
  const shelves = [y - 23, y - 10, y + 3];
  for (const [i, sy] of shelves.entries()) {
    rect(ctx, BEAM_DARK, x + 3, sy, w - 6, 10);
    for (let bx = x + 4; bx < x + w - 6;) {
      const bw = 2 + Math.floor(rand(bx, i, 1) * 2);
      const bh = 6 + Math.floor(rand(bx, i, 2) * 4);
      const col = ["#c8322b", "#2f6db5", "#e0b040", "#4f9d4a", "#efe3c8", "#8a6fbf"][Math.floor(rand(bx, i, 3) * 6)]!;
      rect(ctx, col, bx, sy + 10 - bh, bw, bh);
      bx += bw + (rand(bx, i, 4) < 0.15 ? 2 : 0);
    }
    rect(ctx, BEAM_LIGHT, x + 2, sy + 10, w - 4, 2);
  }
  // The papers, one per tile, on the middle shelf.
  const colors = ["#2f7f7a", "#8a6fbf", "#d1497a"];
  books.forEach((b, i) => {
    const cx = b.x * TILE + 8;
    const sy = shelves[1]!;
    rect(ctx, INK, cx - 3, sy - 1, 7, 11);
    rect(ctx, colors[i % colors.length]!, cx - 2, sy, 5, 10);
    rect(ctx, "#ffd166", cx - 2, sy + 3, 5, 2);
  });
}

function trophies(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE - 8;
  rect(ctx, "rgba(0,0,0,0.3)", x + 2, y + 38, 14, 3);
  rect(ctx, INK, x, y, 16, 40);
  rect(ctx, WOOD_DARK, x + 1, y + 1, 14, 38);
  rect(ctx, "#cfe8f0", x + 2, y + 3, 12, 22);
  rect(ctx, "#ffffff", x + 3, y + 4, 1, 8);
  rect(ctx, WOOD, x + 2, y + 14, 12, 1);
  // Cup
  rect(ctx, GOLD, x + 5, y + 5, 7, 3);
  rect(ctx, GOLD, x + 6, y + 8, 5, 1);
  rect(ctx, GOLD, x + 8, y + 9, 1, 2);
  rect(ctx, GOLD, x + 6, y + 11, 5, 2);
  rect(ctx, "#fff3a0", x + 6, y + 5, 1, 2);
  // Medal and plaque
  rect(ctx, "#2f6db5", x + 4, y + 16, 1, 4);
  rect(ctx, RED, x + 5, y + 16, 1, 4);
  rect(ctx, GOLD, x + 3, y + 20, 4, 3);
  rect(ctx, BEAM, x + 9, y + 17, 4, 6);
  rect(ctx, GOLD, x + 10, y + 19, 2, 1);
  // Cupboard
  rect(ctx, WOOD, x + 2, y + 27, 12, 10);
  rect(ctx, WOOD_DARK, x + 8, y + 27, 1, 10);
  rect(ctx, GOLD, x + 6, y + 31, 1, 2);
  rect(ctx, GOLD, x + 10, y + 31, 1, 2);
}

function teaTable(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  rect(ctx, "rgba(0,0,0,0.3)", x + 7, y + 12, 20, 2);
  rect(ctx, INK, x + 6, y + 2, 20, 4);
  rect(ctx, WOOD, x + 7, y + 2, 18, 2);
  rect(ctx, INK, x + 8, y + 6, 2, 7);
  rect(ctx, INK, x + 22, y + 6, 2, 7);
  // Teapot and cups
  rect(ctx, INK, x + 10, y - 4, 6, 6);
  rect(ctx, WHITE, x + 11, y - 3, 4, 4);
  rect(ctx, "#2f6db5", x + 11, y - 2, 4, 1);
  rect(ctx, WHITE, x + 16, y - 2, 2, 1);
  rect(ctx, WHITE, x + 19, y, 2, 2);
  rect(ctx, WHITE, x + 22, y, 2, 2);
  // Tiny plastic stools
  for (const [sx, col] of [
    [x, "#3a7bd5"],
    [x + 27, "#d63a2a"],
  ] as const) {
    rect(ctx, INK, sx, y + 6, 5, 2);
    rect(ctx, col, sx, y + 6, 5, 1);
    rect(ctx, col, sx, y + 8, 1, 5);
    rect(ctx, col, sx + 4, y + 8, 1, 5);
  }
}

/** A step-through motorbike, side on, facing the door. */
function motorbike(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  rect(ctx, "rgba(0,0,0,0.3)", x + 2, y + 14, 30, 2);
  for (const cx of [x + 7, x + 25]) {
    rect(ctx, INK, cx - 4, y + 6, 8, 8);
    rect(ctx, INK, cx - 3, y + 5, 6, 10);
    rect(ctx, "#3a3a44", cx - 2, y + 7, 4, 6);
    rect(ctx, "#9aa8b8", cx - 1, y + 9, 2, 2);
  }
  rect(ctx, "#c0c6cc", x + 1, y + 11, 9, 2); // exhaust
  rect(ctx, INK, x + 2, y - 1, 15, 8);
  rect(ctx, "#c0392b", x + 3, y, 13, 6); // rear body
  rect(ctx, "#2b2233", x + 3, y - 3, 11, 3); // seat
  rect(ctx, "#3a3a44", x + 13, y + 6, 8, 2); // step-through floor
  rect(ctx, INK, x + 17, y - 4, 5, 11);
  rect(ctx, "#efe3c8", x + 18, y - 3, 3, 9); // leg shield
  rect(ctx, "#9aa8b8", x + 23, y - 6, 2, 12); // fork
  rect(ctx, "#9aa8b8", x + 20, y - 7, 7, 1); // handlebar
  rect(ctx, "#ffd166", x + 26, y - 5, 3, 2); // headlight
  rect(ctx, "#c0392b", x + 21, y + 2, 7, 2); // front fender
}

function doorPlant(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, "#4f9d4a", px + 3, py - 4, 10, 8);
  rect(ctx, "#6dbb5b", px + 5, py - 6, 6, 6);
  rect(ctx, INK, px + 4, py + 4, 8, 10);
  rect(ctx, "#c98f5c", px + 5, py + 5, 6, 8);
  // Sandals by the door
  for (const sx of [px - 74, px - 68]) {
    rect(ctx, "#d1497a", sx, py + 5, 3, 7);
    rect(ctx, "#8a2a50", sx, py + 7, 3, 1);
  }
}

function exitMat(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, TILE_BASE, px, py, TILE, TILE);
  rect(ctx, "#8a5a3b", px + 1, py + 1, 14, 13);
  rect(ctx, "#c98f5c", px + 2, py + 2, 12, 11);
  for (let i = 0; i < 4; i++) {
    rect(ctx, RED, px + 4 + i, py + 4 + i, 1, 2);
    rect(ctx, RED, px + 11 - i, py + 4 + i, 1, 2);
  }
}

/** Bake the whole house into one canvas, like the town. */
export function bakeHome(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext("2d")!;
  for (let ty = 2; ty <= 8; ty++) for (let tx = 1; tx < COLS - 1; tx++) woodFloor(ctx, tx, ty);
  for (let ty = 11; ty < ROWS - 1; ty++) for (let tx = 1; tx < COLS - 1; tx++) cementTile(ctx, tx, ty);
  walls(ctx);
  rug(ctx);
  clockFace(ctx);
  windowFrame(ctx);
  lanterns(ctx);
  photos(ctx);
  const books: TownObject[] = [];
  for (const o of HOME_OBJECTS) {
    if (o.id.startsWith("book-")) books.push(o);
    else if (o.style === "vn-flag") vnFlag(ctx, o);
    else if (o.style === "sigma-chi") sigmaChiFlag(ctx, o);
    else if (o.style === "hornets") hornetsFlag(ctx, o);
    else if (o.style === "tv") tv(ctx, o);
    else if (o.style === "fridge") fridge(ctx, o);
    else if (o.style === "phin") phin(ctx, o);
    else if (o.style === "palm") palm(ctx, o);
    else if (o.style === "bamboo") bamboo(ctx, o);
    else if (o.style === "desk") desk(ctx, o);
    else if (o.style === "trophies") trophies(ctx, o);
    else if (o.style === "tea") teaTable(ctx, o);
    else if (o.style === "motorbike") motorbike(ctx, o);
    else if (o.style === "plant-door") doorPlant(ctx, o);
    else if (o.style === "exit") exitMat(ctx, o);
  }
  bookshelf(ctx, books);
  return canvas;
}

// ───────────────────────────── live layer ─────────────────────────────

function hand(ctx: Ctx, angle: number, len: number, color: string) {
  for (let i = 1; i <= len; i++) rect(ctx, color, CLOCK.x + Math.round(Math.cos(angle) * i), CLOCK.y + Math.round(Math.sin(angle) * i), 1, 1);
}

const SKIES: Record<Sky, { top: string; bottom: string; roofs: [string, string]; lights: string }> = {
  night: { top: "#141b3a", bottom: "#2a3266", roofs: ["#2a2340", "#352c4f"], lights: "#ffd166" },
  dawn: { top: "#7a6fb0", bottom: "#ffb38a", roofs: ["#8a5a5a", "#a86b5a"], lights: "#ffe9a8" },
  day: { top: "#6cc4ff", bottom: "#bfe6ff", roofs: ["#c98f5c", "#e9b949"], lights: "#5e3a22" },
  dusk: { top: "#5b4a9a", bottom: "#ff9a5a", roofs: ["#6b3f4a", "#7e4a4f"], lights: "#ffd166" },
};

/** Old Quarter rooftops: [x offset, width, height]. */
const ROOFS = [
  [0, 4, 6],
  [4, 5, 9],
  [9, 3, 5],
  [12, 4, 8],
  [16, 4, 6],
] as const;

function windowView(ctx: Ctx, sky: Sky) {
  const s = SKIES[sky];
  rect(ctx, s.top, WIN.x, WIN.y, WIN.w, WIN.h / 2);
  rect(ctx, s.bottom, WIN.x, WIN.y + WIN.h / 2, WIN.w, WIN.h / 2);
  if (sky === "night") {
    for (const [sx, sy] of [
      [2, 2],
      [7, 4],
      [11, 1],
      [3, 6],
    ] as const)
      rect(ctx, "#ffffff", WIN.x + sx, WIN.y + sy, 1, 1);
    rect(ctx, "#fff3c4", WIN.x + 14, WIN.y + 2, 3, 3);
    rect(ctx, s.top, WIN.x + 15, WIN.y + 2, 2, 1);
  } else if (sky === "day") {
    rect(ctx, "#fff3a0", WIN.x + 14, WIN.y + 2, 3, 3);
    rect(ctx, "#ffffff", WIN.x + 3, WIN.y + 4, 6, 2);
    rect(ctx, "#ffffff", WIN.x + 4, WIN.y + 3, 3, 1);
  } else {
    rect(ctx, "#ffcf66", WIN.x + (sky === "dawn" ? 3 : 13), WIN.y + 8, 4, 2);
  }
  ROOFS.forEach(([dx, w, h], i) => {
    const top = WIN.y + WIN.h - h;
    rect(ctx, s.roofs[i % 2]!, WIN.x + dx, top, w, h);
    rect(ctx, s.roofs[(i + 1) % 2]!, WIN.x + dx, top, w, 1);
    for (let wy = top + 2; wy < WIN.y + WIN.h - 1; wy += 3) if (rand(i, wy, 5) < 0.6) rect(ctx, s.lights, WIN.x + dx + 1, wy, 1, 1);
  });
  // Window bars
  rect(ctx, BEAM_DARK, WIN.x + WIN.w / 2 - 1, WIN.y, 2, WIN.h);
  rect(ctx, BEAM_DARK, WIN.x, WIN.y + WIN.h / 2 - 1, WIN.w, 1);
}

/** The visitor is standing behind the couch (between it and the TV), so it hides their legs. */
const behindCouch = (player: Point) => player.y < COUCH_Y;

/**
 * Drawn every frame beneath the visitor: everything that depends on the time in Dan's time zone,
 * and the couch with the twin on it, unless the visitor is behind it (see drawHomeOver).
 */
export function drawHomeLive(ctx: Ctx, player: Point) {
  const { h, m } = easternTime();
  const sky = skyAt(h + m / 60);
  windowView(ctx, sky);
  hand(ctx, (((h % 12) + m / 60) / 12) * Math.PI * 2 - Math.PI / 2, 3, INK);
  hand(ctx, (m / 60) * Math.PI * 2 - Math.PI / 2, 5, RED);
  rect(ctx, INK, CLOCK.x, CLOCK.y, 1, 1);
  if (sky === "night" || sky === "dusk") {
    // Lanterns glow after dark.
    for (const cx of LANTERNS) {
      rect(ctx, "rgba(255, 190, 90, 0.16)", cx - 9, 4, 19, 20);
      rect(ctx, "rgba(255, 190, 90, 0.14)", cx - 6, 1, 13, 26);
      rect(ctx, "#ff8a5b", cx - 2, 10, 2, 5);
    }
  }
  if (!behindCouch(player)) seatedTwin(ctx);
}

/** Drawn over the visitor: the doorway's beam, and the couch and twin when the visitor walks behind them. */
export function drawHomeOver(ctx: Ctx, player: Point) {
  doorLintel(ctx);
  if (behindCouch(player)) seatedTwin(ctx);
}
