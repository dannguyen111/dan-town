/**
 * The inside of Crate & Closet: a vintage record shop with a thrift corner, where Dan's music and
 * fashion live. The jukebox plays his top tracks, the gig posters are his top artists, and the
 * clothing rack (and the polaroids above it) tell the Fashion Initiative story. Each opens a console
 * from the Crate & Closet page (pages/music.astro).
 *
 * Ground legend:  # wall (solid) · . wood floor
 */
import { text, textWidth } from "./dev.ts";
import { bitmap, rand, rect, type Ctx } from "./home.ts";
import { TILE, type Point, type TownObject } from "./map.ts";

export const SHOP_GROUND = [
  "#############", // 0  back wall (gig posters · neon sign · polaroids)
  "#############", // 1
  "#...........#", // 2
  "#...........#", // 3  jukebox
  "#...........#", // 4
  "#...........#", // 5  clothing rack
  "#...........#", // 6  record crates
  "#...........#", // 7
  "#...........#", // 8  mirror
  "#...........#", // 9  DJ booth
  "#...........#", // 10
  "#...........#", // 11 counter
  "#...........#", // 12
  "#...........#", // 13
  "######.######", // 14 front wall, exit mat in the gap
] as const;

const COLS = SHOP_GROUND[0].length;
const ROWS = SHOP_GROUND.length;

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
/** A station opens a console: `event` defaults to its own id (the polaroids open the closet). */
const station = (id: string, label: string, x: number, y: number, w: number, h: number, hint: string, labelLift: number, event = id): TownObject => ({
  id,
  kind: "prop",
  x,
  y,
  w,
  h,
  target: { type: "event", name: event },
  label,
  style: id,
  labelLift,
  hint,
});

export const SHOP_OBJECTS: readonly TownObject[] = [
  // ── Back wall ──
  station("shop-posters", "Gig posters", 1, 1, 4, 1, "Look at the gig posters 🎸", 28),
  station("shop-polaroids", "Polaroids", 8, 1, 4, 1, "Look at the polaroids 📸", 28, "shop-closet"),

  // ── The floor ──
  station("shop-jukebox", "Jukebox", 1, 3, 2, 2, "Pick a song on the jukebox 🎵", 14),
  station("shop-closet", "The Closet", 9, 5, 3, 1, "Browse the closet 🧥", 14),
  prop("crates", "Record crates", 4, 6, 4, 1, "Crates of records, sorted by vibe rather than alphabet. Someone filed a jazz record under 'rainy days'."),
  prop("mirror", "Mirror", 11, 8, 1, 2, "A full-length mirror in a gold frame. The fit checks out."),
  prop("decks", "DJ booth", 4, 9, 3, 1, "Two turntables and a mixer, cued up. Dan's other keyboard."),
  prop("counter", "Counter", 1, 11, 2, 1, "The register. Nothing in here is for sale, but the Depop stall across the plaza has the real racks."),
  prop("plant", "Plant", 11, 12, 1, 1, "A shop plant, thriving on a steady diet of vinyl crackle."),
  { id: "exit", kind: "exit", x: 6, y: 14, w: 1, h: 1, door: { x: 6, y: 14 }, target: { type: "place", id: "town" }, label: "Exit", style: "exit", hideLabel: true },
];

export const SHOP_SPAWN: Point = { x: 6, y: 13 };

// ───────────────────────────── art ─────────────────────────────

const INK = "#1d1414";
const WALL = "#6b2a2a";
const WALL_STRIPE = "#5f2525";
const WALL_DARK = "#4a1b1b";
const WALL_EDGE = "#33110f";
const MUSTARD = "#e0a526";
const CREAM = "#f6e7c8";
const FLOOR = "#9a6236";
const FLOOR_DARK = "#7d4c28";
const FLOOR_LIGHT = "#b0743f";
const PINK = "#ff6fae";
const PINK_GLOW = "#7a2a50";
const TEAL = "#3aa6a0";
const ORANGE = "#ff8a3d";
const BLUE = "#4a7fd1";
const CHROME = "#d8d8e0";
const CHROME_DARK = "#9a9aa8";
const WHITE = "#ffffff";
const VINYL = "#141010";

function floorTile(ctx: Ctx, tx: number, ty: number) {
  const px = tx * TILE;
  const py = ty * TILE;
  rect(ctx, FLOOR, px, py, TILE, TILE);
  // Long planks, staggered.
  for (let r = 0; r < 4; r++) {
    const y = py + r * 4;
    rect(ctx, FLOOR_DARK, px, y + 3, TILE, 1);
    rect(ctx, FLOOR_DARK, px + Math.floor(rand(tx, ty, r) * 15), y, 1, 3);
    if (rand(tx, ty, r + 9) < 0.4) rect(ctx, FLOOR_LIGHT, px + Math.floor(rand(tx, ty, r + 4) * 12), y + 1, 3, 1);
  }
}

function walls(ctx: Ctx) {
  const W = COLS * TILE;
  // Oxblood wallpaper with pinstripes, a mustard dado rail, and darker wainscot below it.
  rect(ctx, WALL, 0, 0, W, 2 * TILE);
  for (let x = 2; x < W; x += 6) rect(ctx, WALL_STRIPE, x, 0, 2, 26);
  rect(ctx, WALL_DARK, 0, 0, W, 2);
  rect(ctx, MUSTARD, 0, 26, W, 1);
  rect(ctx, WALL_DARK, 0, 27, W, 5);
  for (let x = 4; x < W; x += 8) rect(ctx, WALL_EDGE, x, 28, 1, 4);
  for (let ty = 2; ty < ROWS; ty++) {
    rect(ctx, WALL_DARK, 0, ty * TILE, TILE, TILE);
    rect(ctx, WALL_DARK, W - TILE, ty * TILE, TILE, TILE);
  }
  rect(ctx, WALL_EDGE, TILE - 1, 2 * TILE, 1, (ROWS - 3) * TILE);
  rect(ctx, WALL_EDGE, W - TILE, 2 * TILE, 1, (ROWS - 3) * TILE);
  const fy = (ROWS - 1) * TILE;
  rect(ctx, WALL_DARK, 0, fy, W, TILE);
  rect(ctx, WALL_EDGE, 0, fy, W, 1);
  neonBoard(ctx);
}

// The neon sign hangs on the back wall between the posters and the polaroids (tiles 5–7).
const SIGN_X = 5 * TILE + 1;
const SIGN_Y = 3;
const SIGN_W = 3 * TILE - 2;
const SIGN_LINES = ["CRATE &", "CLOSET"] as const;

function neonBoard(ctx: Ctx) {
  rect(ctx, INK, SIGN_X - 1, SIGN_Y - 1, SIGN_W + 2, 22);
  rect(ctx, "#1a1020", SIGN_X, SIGN_Y, SIGN_W, 20);
  // The two chains it hangs from.
  rect(ctx, CHROME_DARK, SIGN_X + 6, 0, 1, SIGN_Y);
  rect(ctx, CHROME_DARK, SIGN_X + SIGN_W - 7, 0, 1, SIGN_Y);
}

/** The sign's tubes: lit, or (now and then) one line flickering off. */
function neonText(ctx: Ctx, dimLine: number) {
  SIGN_LINES.forEach((line, i) => {
    const x = SIGN_X + Math.floor((SIGN_W - textWidth(line)) / 2);
    const y = SIGN_Y + 4 + i * 8;
    const lit = i !== dimLine;
    // A halo, then the tube.
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) text(ctx, line, x + dx, y + dy, lit ? PINK_GLOW : "#2a1626");
    text(ctx, line, x, y, lit ? PINK : "#5a2a44");
  });
}

/** Gig posters, screen-printed and stapled up at slightly different heights. */
function posterWall(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE + 2;
  const w = o.w * TILE - 4;
  const looks = [
    { bg: MUSTARD, ink: WALL_EDGE, art: PINK },
    { bg: TEAL, ink: CREAM, art: ORANGE },
    { bg: CREAM, ink: INK, art: BLUE },
    { bg: PINK, ink: INK, art: CREAM },
  ];
  const each = Math.floor(w / looks.length);
  looks.forEach((l, i) => {
    const px = x + i * each + 1;
    const py = 3 + (i % 2) * 2;
    const pw = each - 2;
    rect(ctx, "rgba(0,0,0,0.3)", px + 1, py + 1, pw, 20);
    rect(ctx, l.bg, px, py, pw, 20);
    // A big sun or record, the band name, and the date strip along the bottom.
    rect(ctx, l.art, px + 3, py + 3, pw - 6, 7);
    rect(ctx, l.bg, px + 5, py + 5, pw - 10, 3);
    rect(ctx, l.ink, px + 2, py + 12, pw - 4, 2);
    rect(ctx, l.ink, px + 3, py + 16, pw - 6, 1);
    // Tape.
    rect(ctx, "rgba(255,255,255,0.55)", px + pw / 2 - 2, py - 1, 4, 2);
  });
}

/** Polaroids from the fashion show and the vintage market, on a string with little pegs. */
function polaroids(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE + 2;
  const w = o.w * TILE - 4;
  rect(ctx, CHROME_DARK, x, 5, w, 1);
  const photos = [ORANGE, TEAL, PINK, BLUE];
  photos.forEach((c, i) => {
    const px = x + 2 + i * 15;
    const py = 6 + (i % 2);
    rect(ctx, "rgba(0,0,0,0.3)", px + 1, py + 1, 12, 15);
    rect(ctx, WHITE, px, py, 12, 15);
    rect(ctx, c, px + 1, py + 1, 10, 9);
    // A figure in each photo.
    rect(ctx, INK, px + 5, py + 3, 2, 2);
    rect(ctx, INK, px + 4, py + 5, 4, 5);
    rect(ctx, MUSTARD, px + 5, py - 1, 2, 2);
  });
}

/** The jukebox: an arched Wurlitzer in wood and chrome. Its bubble tubes and glow are drawn live. */
function jukebox(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const top = o.y * TILE - 10;
  const w = o.w * TILE;
  const h = o.h * TILE + 10;
  rect(ctx, "rgba(0,0,0,0.25)", x + 3, top + h, w - 2, 3);
  // The arch.
  rect(ctx, INK, x + 5, top, w - 10, 2);
  rect(ctx, INK, x + 2, top + 2, w - 4, 2);
  rect(ctx, INK, x + 1, top + 4, w - 2, h - 4);
  rect(ctx, "#8a4a24", x + 3, top + 3, w - 6, h - 4);
  rect(ctx, "#a65e30", x + 6, top + 1, w - 12, 2);
  // Chrome trim around the face.
  rect(ctx, CHROME, x + 6, top + 4, w - 12, 1);
  rect(ctx, CHROME, x + 6, top + h - 3, w - 12, 1);
  // The title strips under glass.
  rect(ctx, INK, x + 7, top + 14, w - 14, 9);
  rect(ctx, CREAM, x + 8, top + 15, w - 16, 7);
  for (let l = 0; l < 3; l++) rect(ctx, "#a08060", x + 9, top + 16 + l * 2, w - 18, 1);
  // The speaker grille.
  rect(ctx, "#3a2015", x + 7, top + 26, w - 14, 12);
  for (let g = 0; g < 5; g++) rect(ctx, CHROME_DARK, x + 9 + g * 3, top + 27, 1, 10);
  // Coin slot and buttons.
  rect(ctx, CHROME, x + w / 2 - 3, top + 24, 6, 1);
}

/** Wooden crates of records, sleeves poking up in every colour. */
function crates(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  const w = o.w * TILE;
  rect(ctx, "rgba(0,0,0,0.2)", x + 2, y + 15, w, 3);
  const sleeves = [MUSTARD, TEAL, PINK, CREAM, BLUE, ORANGE, "#8a6fbf", WHITE];
  for (let c = 0; c < 3; c++) {
    const cx = x + 1 + c * 21;
    // Sleeves first, then the crate front over them.
    for (let s = 0; s < 6; s++) {
      const sh = 8 + Math.floor(rand(c, s, 4) * 4);
      rect(ctx, INK, cx + 1 + s * 3, y + 6 - sh + 4, 3, sh);
      rect(ctx, sleeves[(c * 3 + s) % sleeves.length]!, cx + 1 + s * 3, y + 7 - sh + 4, 2, sh - 1);
    }
    rect(ctx, INK, cx, y + 4, 20, 12);
    rect(ctx, "#c98f5c", cx + 1, y + 5, 18, 10);
    rect(ctx, "#9c6a3f", cx + 1, y + 9, 18, 1);
    rect(ctx, "#9c6a3f", cx + 1, y + 12, 18, 1);
    rect(ctx, "#7a4f2a", cx + 7, y + 6, 6, 2);
  }
}

/** A chrome clothing rail of vintage pieces: shirts, a coat, a dress. */
function rack(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  const w = o.w * TILE;
  rect(ctx, "rgba(0,0,0,0.2)", x + 2, y + 15, w - 2, 3);
  // Rail and legs.
  rect(ctx, INK, x + 1, y - 12, w - 2, 3);
  rect(ctx, CHROME, x + 2, y - 11, w - 4, 1);
  for (const lx of [x + 2, x + w - 4]) {
    rect(ctx, INK, lx, y - 12, 2, 28);
    rect(ctx, CHROME_DARK, lx, y + 14, 3, 2);
  }
  const clothes: { c: string; long: boolean }[] = [
    { c: MUSTARD, long: false },
    { c: "#3b5d8f", long: true },
    { c: PINK, long: false },
    { c: CREAM, long: false },
    { c: "#5a3a2a", long: true },
    { c: TEAL, long: false },
  ];
  clothes.forEach((g, i) => {
    const gx = x + 6 + i * 6;
    const len = g.long ? 22 : 15;
    // Hanger hook, shoulders, then the body.
    rect(ctx, CHROME_DARK, gx + 2, y - 10, 1, 2);
    rect(ctx, INK, gx - 1, y - 8, 7, len + 1);
    rect(ctx, g.c, gx, y - 7, 5, len - 1);
    rect(ctx, "rgba(0,0,0,0.2)", gx + 2, y - 7, 1, len - 1);
  });
  // A price tag on the end.
  rect(ctx, CREAM, x + w - 9, y - 6, 4, 5);
  rect(ctx, WALL, x + w - 8, y - 4, 2, 1);
}

/** The DJ booth: two turntables and a mixer on a draped table. The platters spin live. */
function decks(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  const w = o.w * TILE;
  rect(ctx, "rgba(0,0,0,0.2)", x + 2, y + 15, w, 3);
  rect(ctx, INK, x, y - 4, w, 20);
  rect(ctx, "#2b2228", x + 1, y - 3, w - 2, 9);
  // The front drape, with "DJ" on it.
  rect(ctx, WALL, x + 1, y + 6, w - 2, 9);
  rect(ctx, MUSTARD, x + 1, y + 6, w - 2, 1);
  text(ctx, "DJ", x + w / 2 - 3, y + 8, CREAM);
  // Two decks and the mixer between them.
  for (const dx of [x + 3, x + w - 19]) {
    rect(ctx, "#4a4048", dx, y - 3, 16, 9);
    rect(ctx, CHROME_DARK, dx + 13, y - 2, 1, 6);
  }
  rect(ctx, "#4a4048", x + 20, y - 3, 8, 9);
  for (let f = 0; f < 3; f++) rect(ctx, f === 1 ? PINK : CREAM, x + 21 + f * 2, y - 1 + (f % 2) * 2, 1, 2);
}

function mirror(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE + 2;
  const top = o.y * TILE - 8;
  rect(ctx, "rgba(0,0,0,0.2)", x + 2, top + 40, 12, 3);
  rect(ctx, INK, x, top, 12, 40);
  rect(ctx, MUSTARD, x + 1, top + 1, 10, 38);
  rect(ctx, "#bcd8e0", x + 2, top + 3, 8, 34);
  rect(ctx, "#e6f4f7", x + 3, top + 5, 2, 10);
  rect(ctx, "#e6f4f7", x + 6, top + 8, 1, 4);
}

/** The counter with a chunky mustard cash register on it. */
function counter(ctx: Ctx, o: TownObject) {
  const x = o.x * TILE;
  const y = o.y * TILE;
  const w = o.w * TILE;
  rect(ctx, "rgba(0,0,0,0.2)", x + 2, y + 15, w, 3);
  rect(ctx, INK, x, y - 2, w, 18);
  rect(ctx, "#7a4f2a", x + 1, y - 1, w - 2, 4);
  rect(ctx, "#5c3a1e", x + 1, y + 3, w - 2, 12);
  rect(ctx, "#6e4626", x + 4, y + 6, w - 8, 6);
  bitmap(ctx, ["..kkkkkk..", ".kmmmmmmk.", ".kmwwwwmk.", "kmmmmmmmmk", "kmcmcmcmmk", "kkkkkkkkkk"], x + 4, y - 7, { k: INK, m: MUSTARD, w: "#bfe6c0", c: CREAM });
  // A stack of paper bags.
  rect(ctx, INK, x + 20, y - 6, 8, 6);
  rect(ctx, "#c9a46a", x + 21, y - 5, 6, 5);
}

function plant(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, "#2f8a55", px + 3, py - 4, 10, 8);
  rect(ctx, "#47b06f", px + 5, py - 6, 6, 6);
  rect(ctx, "#236b42", px + 2, py + 1, 3, 3);
  rect(ctx, "#236b42", px + 11, py + 1, 3, 3);
  rect(ctx, INK, px + 4, py + 6, 8, 9);
  rect(ctx, MUSTARD, px + 5, py + 7, 6, 7);
}

function exitMat(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, FLOOR, px, py, TILE, TILE);
  rect(ctx, WALL_EDGE, px + 1, py + 1, 14, 13);
  rect(ctx, WALL, px + 2, py + 2, 12, 11);
  for (let i = 0; i < 4; i++) {
    rect(ctx, MUSTARD, px + 4 + i, py + 4 + i, 1, 2);
    rect(ctx, MUSTARD, px + 11 - i, py + 4 + i, 1, 2);
  }
}

/** Bake the whole room into one canvas, like the town. */
export function bakeShop(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext("2d")!;
  for (let ty = 2; ty < ROWS - 1; ty++) for (let tx = 1; tx < COLS - 1; tx++) floorTile(ctx, tx, ty);
  // A worn rug in front of the DJ booth.
  rect(ctx, "#5a2a3a", 3 * TILE + 4, 10 * TILE + 3, 5 * TILE - 8, TILE - 4);
  rect(ctx, "#7a3a4e", 3 * TILE + 6, 10 * TILE + 5, 5 * TILE - 12, TILE - 8);
  walls(ctx);
  neonText(ctx, -1);
  for (const o of SHOP_OBJECTS) {
    if (o.style === "shop-posters") posterWall(ctx, o);
    else if (o.style === "shop-polaroids") polaroids(ctx, o);
    else if (o.style === "shop-jukebox") jukebox(ctx, o);
    else if (o.style === "shop-closet") rack(ctx, o);
    else if (o.style === "crates") crates(ctx, o);
    else if (o.style === "decks") decks(ctx, o);
    else if (o.style === "mirror") mirror(ctx, o);
    else if (o.style === "counter") counter(ctx, o);
    else if (o.style === "plant") plant(ctx, o);
    else if (o.style === "exit") exitMat(ctx, o);
  }
  return canvas;
}

// ───────────────────────────── live layer ─────────────────────────────

const JUKEBOX = SHOP_OBJECTS.find((o) => o.id === "shop-jukebox")!;
const DECKS = SHOP_OBJECTS.find((o) => o.id === "decks")!;
const BUBBLES = [PINK, MUSTARD, TEAL, ORANGE];
/** Where the platter's marker sits after each step of a turn, around a 3px ring. */
const SPIN: readonly Point[] = [
  { x: 0, y: -3 },
  { x: 2, y: -2 },
  { x: 3, y: 0 },
  { x: 2, y: 2 },
  { x: 0, y: 3 },
  { x: -2, y: 2 },
  { x: -3, y: 0 },
  { x: -2, y: -2 },
];

/** The jukebox's bubble tubes and arch glow cycle, the turntables spin, and the neon flickers. */
export function drawShopLive(ctx: Ctx, _player: Point) {
  const tick = Math.floor(Date.now() / 1000);

  // Jukebox: the arch window glows in a colour that moves on each second, with bubbles rising up the side tubes.
  const jx = JUKEBOX.x * TILE;
  const jtop = JUKEBOX.y * TILE - 10;
  const jw = JUKEBOX.w * TILE;
  const glow = BUBBLES[tick % BUBBLES.length]!;
  rect(ctx, glow, jx + 7, jtop + 6, jw - 14, 6);
  rect(ctx, "rgba(255,255,255,0.45)", jx + 8, jtop + 7, 4, 1);
  for (const tx of [jx + 3, jx + jw - 5]) {
    rect(ctx, "#2a1a10", tx, jtop + 6, 2, 30);
    for (let b = 0; b < 4; b++) {
      const by = jtop + 34 - ((tick * 3 + b * 8) % 28);
      rect(ctx, BUBBLES[(b + tick) % BUBBLES.length]!, tx, by, 2, 2);
    }
  }

  // Turntables: a record on each, its label marker going round.
  const dx = DECKS.x * TILE;
  const dy = DECKS.y * TILE;
  const dw = DECKS.w * TILE;
  for (const [i, cx] of [dx + 9, dx + dw - 13].entries()) {
    const cy = dy + 1;
    rect(ctx, VINYL, cx - 4, cy - 3, 9, 7);
    rect(ctx, VINYL, cx - 3, cy - 4, 7, 9);
    rect(ctx, i ? PINK : MUSTARD, cx - 1, cy - 1, 3, 3);
    const m = SPIN[(tick + i * 3) % SPIN.length]!;
    rect(ctx, "#6a6070", cx + m.x, cy + m.y, 1, 1);
  }

  // The neon sign: every so often, one line stutters off for a second.
  rect(ctx, "#1a1020", SIGN_X, SIGN_Y, SIGN_W, 20);
  const r = rand(tick, 7, 3);
  neonText(ctx, r < 0.12 ? 1 : r < 0.18 ? 0 : -1);
}
