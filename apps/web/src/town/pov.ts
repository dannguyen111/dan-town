/**
 * Close-up views of Home, as if you were in the room:
 *
 *  - "tv":    sitting on the couch, looking at the TV wall (the video plays inside the set).
 *  - "couch": the reverse shot, from the TV: the twin on the couch, his posters, the doorway.
 *  - "desk":  sitting at the computer, the monitor filling the view (a live terminal sits on it).
 *
 * Each view is drawn on a 320×180 frame of pixel art, scaled by a whole number so it stays crisp.
 * When the canvas is a different shape, the wall, ceiling and floor carry on past the frame.
 * DOM content (the YouTube player, the terminal) is placed over `SCREENS` with `screenBox`.
 */
import { face, type FaceFrame } from "../twin/face.ts";
import {
  BEAM,
  BEAM_DARK,
  BEAM_LIGHT,
  CHI,
  COUCH,
  COUCH_DARK,
  COUCH_LIGHT,
  type Ctx,
  GOLD,
  HORNETS_LOGO,
  INK,
  MINT,
  MINT_LIGHT,
  MINT_SHADE,
  OCHRE,
  OCHRE_SHADE,
  RED,
  SIGMA,
  SKIES,
  STAR,
  type Sky,
  TILE_BASE,
  TILE_RED,
  TILE_TEAL,
  WHITE,
  WOOD,
  WOOD_DARK,
  WOOD_LIGHT,
  easternTime,
  outlined,
  rand,
  rect,
  skyAt,
  windowView,
} from "./home.ts";
import { TWIN_PALETTE, PHONE_COLOURS } from "./sprites.ts";

export type PovId = "tv" | "couch" | "desk";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRAME: Box = { x: 0, y: 0, w: 320, h: 180 };

/** Where DOM content goes, in frame pixels. Both screens are 16:9. */
export const SCREENS = {
  tv: { x: 124, y: 50, w: 80, h: 45 },
  desk: { x: 48, y: 22, w: 160, h: 90 },
} as const satisfies Partial<Record<PovId, Box>>;

/** The twin's head and both posters: what the chat's little webcam shows. */
export const WEBCAM: Box = { x: 56, y: 16, w: 208, h: 117 };

export interface PovLayout {
  /** Device pixels per frame pixel. */
  s: number;
  dpr: number;
  /** Canvas size in frame pixels. */
  W: number;
  H: number;
  /** Where the frame's origin sits on the canvas, in frame pixels. */
  ox: number;
  oy: number;
}

/** Fit `focus` (the whole frame by default) inside the canvas at a whole-number scale, centred. */
export function povLayout(cssW: number, cssH: number, dpr: number, focus: Box = FRAME): PovLayout {
  const devW = Math.round(cssW * dpr);
  const devH = Math.round(cssH * dpr);
  const s = Math.max(1, Math.floor(Math.min(devW / focus.w, devH / focus.h)));
  const W = Math.ceil(devW / s);
  const H = Math.ceil(devH / s);
  return { s, dpr, W, H, ox: Math.floor((W - focus.w) / 2) - focus.x, oy: Math.floor((H - focus.h) / 2) - focus.y };
}

/** A frame-pixel box in CSS pixels, relative to the canvas's top-left corner. */
export function screenBox(L: PovLayout, b: Box) {
  const k = L.s / L.dpr;
  return { left: (L.ox + b.x) * k, top: (L.oy + b.y) * k, width: b.w * k, height: b.h * k };
}

/** The visible area in frame pixels: how far the wall and floor must carry on. */
interface Bounds {
  l: number;
  r: number;
  t: number;
  b: number;
}

const FACE_IDLE: FaceFrame = { mouth: 0, blink: false, look: 0, talking: false };

/** Where the twin's headphones are, and whether his hands are up holding them. */
export interface Pose {
  phones: "head" | "lifted" | "jaw" | "neck";
  hands: boolean;
}
export const PHONES_ON: Pose = { phones: "head", hands: false };
export const PHONES_OFF: Pose = { phones: "neck", hands: false };

/**
 * Taking the headphones off when you sit down to talk, as a few held pixel-art poses: hands up to
 * the cups, lift them off, bring them down past his jaw, rest them around his neck, hands down.
 * The first beat waits for the camera's zoom to land. Times are ms since the close-up opened.
 */
export const PHONES_OFF_STEPS: readonly [number, Pose][] = [
  [0, PHONES_ON],
  [550, { phones: "head", hands: true }],
  [800, { phones: "lifted", hands: true }],
  [1050, { phones: "jaw", hands: true }],
  [1300, { phones: "neck", hands: true }],
  [1550, PHONES_OFF],
];

export function phonesOffPose(ms: number): Pose {
  let pose = PHONES_ON;
  for (const [at, p] of PHONES_OFF_STEPS) if (ms >= at) pose = p;
  return pose;
}

/** Milliseconds until the next pose, or null once the headphones are off. */
export function nextPoseIn(ms: number): number | null {
  const next = PHONES_OFF_STEPS.find(([at]) => at > ms);
  return next ? next[0] - ms : null;
}

export function drawPov(ctx: Ctx, id: PovId, L: PovLayout, now: Date = new Date(), f: FaceFrame = FACE_IDLE, pose: Pose = PHONES_ON) {
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(L.s, 0, 0, L.s, L.ox * L.s, L.oy * L.s);
  const b: Bounds = { l: -L.ox, r: L.W - L.ox, t: -L.oy, b: L.H - L.oy };
  const { h, m } = easternTime(now);
  const sky = skyAt(h + m / 60);
  if (id === "tv") tvWall(ctx, b, sky, h, m);
  else if (id === "couch") couchView(ctx, b, sky, f, pose);
  else deskView(ctx, b);
}

// ───────────────────────────── shared pieces ─────────────────────────────

/** Scaled bitmap: each cell is k×k. */
function bitmapK(ctx: Ctx, rows: readonly string[], x: number, y: number, colors: Record<string, string>, k: number) {
  rows.forEach((row, ry) => [...row].forEach((c, rx) => colors[c] && rect(ctx, colors[c]!, x + rx * k, y + ry * k, k, k)));
}

/** A filled disc, row by row, so it stays pixel-crisp. */
function disc(ctx: Ctx, cx: number, cy: number, r: number, color: string, from = -r, to = r) {
  for (let dy = from; dy <= to; dy++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    rect(ctx, color, cx - half, cy + dy, half * 2 + 1, 1);
  }
}

/** Ochre plaster from edge to edge, a ceiling beam, a skirting board, and the floor below. */
function room(ctx: Ctx, b: Bounds, floorY: number, floor: "wood" | "none") {
  const w = b.r - b.l;
  // Ceiling planks above the frame, when the canvas is taller than it.
  if (b.t < 0) {
    rect(ctx, "#4a2c19", b.l, b.t, w, -b.t);
    for (let y = -6; y > b.t; y -= 6) rect(ctx, BEAM_DARK, b.l, y, w, 1);
  }
  rect(ctx, OCHRE, b.l, 0, w, floorY);
  for (let i = 0; i < w / 2; i++) {
    const sx = b.l + Math.floor(rand(i, floorY, 1) * w);
    const sy = 10 + Math.floor(rand(i, floorY, 2) * (floorY - 20));
    rect(ctx, OCHRE_SHADE, sx, sy, 1 + Math.floor(rand(i, floorY, 3) * 3), 1);
  }
  rect(ctx, BEAM, b.l, 0, w, 7);
  rect(ctx, BEAM_DARK, b.l, 7, w, 1);
  rect(ctx, BEAM, b.l, floorY - 5, w, 5);
  rect(ctx, BEAM_LIGHT, b.l, floorY - 5, w, 1);
  if (floor === "none") return;
  rect(ctx, WOOD, b.l, floorY, w, b.b - floorY);
  // Planks get wider toward you.
  for (let y = floorY + 3, gap = 3; y < b.b; y += gap, gap += 1) rect(ctx, WOOD_DARK, b.l, y, w, 1);
  for (let i = 0; i < w / 6; i++) rect(ctx, WOOD_LIGHT, b.l + Math.floor(rand(i, 7, 4) * w), floorY + 2 + Math.floor(rand(i, 7, 5) * (b.b - floorY)), 4, 1);
}

function hangingRod(ctx: Ctx, x: number, y: number, w: number) {
  rect(ctx, INK, x - 3, y - 3, w + 6, 2);
  rect(ctx, GOLD, x - 4, y - 3, 1, 2);
  rect(ctx, GOLD, x + w + 3, y - 3, 1, 2);
}

function lantern(ctx: Ctx, cx: number, top: number, lit: boolean) {
  rect(ctx, INK, cx, 7, 1, top - 7);
  if (lit) {
    rect(ctx, "rgba(255, 190, 90, 0.14)", cx - 13, top - 4, 27, 30);
    rect(ctx, "rgba(255, 190, 90, 0.14)", cx - 9, top - 7, 19, 36);
  }
  rect(ctx, GOLD, cx - 3, top, 7, 1);
  rect(ctx, "#c8322b", cx - 6, top + 2, 13, 11);
  rect(ctx, "#c8322b", cx - 4, top + 1, 9, 13);
  rect(ctx, lit ? "#ff8a5b" : "#e85a3c", cx - 3, top + 2, 3, 11);
  rect(ctx, "#a8231c", cx + 3, top + 2, 2, 11);
  rect(ctx, GOLD, cx - 3, top + 14, 7, 1);
  rect(ctx, GOLD, cx, top + 15, 1, 6);
}

function couplet(ctx: Ctx, x: number, y: number) {
  rect(ctx, "#a8231c", x, y, 8, 30);
  rect(ctx, "#c8322b", x + 1, y + 1, 6, 28);
  for (let i = 0; i < 5; i++) rect(ctx, GOLD, x + 3, y + 4 + i * 5, 2, 2);
}

// ───────────────────────────── TV wall (from the couch) ─────────────────────────────

function tvWall(ctx: Ctx, b: Bounds, sky: Sky, h: number, m: number) {
  const floorY = 146;
  room(ctx, b, floorY, "wood");
  const lit = sky === "night" || sky === "dusk";

  // Rug in front of the TV.
  rect(ctx, GOLD, 70, 158, 200, b.b - 158);
  rect(ctx, "#a8322d", 73, 160, 194, b.b - 160);
  rect(ctx, "#c4473d", 80, 164, 180, b.b - 164);
  for (let x = 76; x < 264; x += 8) rect(ctx, GOLD, x, 161, 3, 1);

  fridgeFront(ctx, 8, 52);
  flag(ctx, 42, 16, 44, 29, "#da251d", (x, y, w, hh) => {
    rect(ctx, "#b81d16", x, y + hh - 1, w, 1);
    bitmapK(ctx, STAR, x + Math.floor((w - 18) / 2), y + Math.floor((hh - 18) / 2), { "#": "#ffde00" }, 2);
  });
  wallClock(ctx, 102, 32, 9, h, m);
  flag(ctx, 226, 16, 44, 29, "#0b4f8a", (x, y, w, hh) => {
    rect(ctx, "#fed141", x, y + hh - 3, w, 1);
    rect(ctx, "#ffffff", x, y + hh - 2, w, 1);
    outlined(ctx, SIGMA, x + 12, y + 8, "#fed141", "#06233f");
    outlined(ctx, CHI, x + 25, y + 8, "#fed141", "#06233f");
  });
  const win = { x: 284, y: 14, w: 28, h: 26 };
  rect(ctx, BEAM_DARK, win.x - 2, win.y - 2, win.w + 4, win.h + 4);
  for (const sx of [win.x - 9, win.x + win.w + 2]) {
    rect(ctx, "#24533d", sx, win.y - 2, 7, win.h + 4);
    for (let y = win.y; y < win.y + win.h; y += 2) rect(ctx, "#3f8a64", sx + 1, y, 5, 1);
  }
  windowView(ctx, sky, win);
  rect(ctx, BEAM_LIGHT, win.x - 4, win.y + win.h + 2, win.w + 8, 2);
  lantern(ctx, 128, 10, lit);
  lantern(ctx, 208, 10, lit);
  tvSet(ctx);

  // In the foreground: the couch's arm, and the back of the twin's head beside you.
  rect(ctx, INK, b.l, 150, 40 - b.l, b.b - 150);
  rect(ctx, COUCH_DARK, b.l, 152, 38 - b.l, b.b - 152);
  rect(ctx, COUCH, b.l, 152, 38 - b.l, 6);
  rect(ctx, COUCH_LIGHT, b.l, 152, 36 - b.l, 1);
  headFromBehind(ctx, 262, 166);
}

function flag(ctx: Ctx, x: number, y: number, w: number, hh: number, bg: string, paint: (x: number, y: number, w: number, h: number) => void) {
  hangingRod(ctx, x, y, w);
  rect(ctx, "rgba(0,0,0,0.18)", x + 2, y + 2, w, hh);
  rect(ctx, bg, x, y, w, hh);
  paint(x, y, w, hh);
}

function wallClock(ctx: Ctx, cx: number, cy: number, r: number, h: number, m: number) {
  disc(ctx, cx, cy, r + 1, INK);
  disc(ctx, cx, cy, r, BEAM_LIGHT);
  disc(ctx, cx, cy, r - 2, WHITE);
  for (const [dx, dy] of [
    [0, -(r - 3)],
    [r - 3, 0],
    [0, r - 3],
    [-(r - 3), 0],
  ] as const)
    rect(ctx, INK, cx + dx, cy + dy, 1, 1);
  const hand = (angle: number, len: number, color: string) => {
    for (let i = 1; i <= len; i++) rect(ctx, color, cx + Math.round(Math.cos(angle) * i), cy + Math.round(Math.sin(angle) * i), 1, 1);
  };
  hand((((h % 12) + m / 60) / 12) * Math.PI * 2 - Math.PI / 2, r - 5, INK);
  hand((m / 60) * Math.PI * 2 - Math.PI / 2, r - 3, RED);
  rect(ctx, INK, cx, cy, 1, 1);
}

function fridgeFront(ctx: Ctx, x: number, y: number) {
  const w = 30;
  const h = 146 - y;
  rect(ctx, INK, x, y, w, h);
  rect(ctx, MINT, x + 1, y + 1, w - 2, h - 2);
  rect(ctx, MINT_LIGHT, x + 1, y + 1, 2, h - 2);
  rect(ctx, MINT_SHADE, x + w - 3, y + 1, 2, h - 2);
  rect(ctx, INK, x + 1, y + 30, w - 2, 1);
  rect(ctx, "#c0c6cc", x + w - 7, y + 8, 2, 16);
  rect(ctx, "#c0c6cc", x + w - 7, y + 36, 2, 22);
  for (const [dx, dy, paper, magnet] of [
    [4, 6, "#fff6b8", RED],
    [6, 38, "#ffd1dc", GOLD],
    [12, 56, "#cfe8ff", TILE_TEAL],
    [4, 70, "#fff6b8", "#2f6db5"],
  ] as const) {
    rect(ctx, paper, x + dx, y + dy, 9, 9);
    rect(ctx, MINT_SHADE, x + dx + 2, y + dy + 3, 5, 1);
    rect(ctx, MINT_SHADE, x + dx + 2, y + dy + 5, 4, 1);
    rect(ctx, magnet, x + dx + 3, y + dy - 1, 3, 2);
  }
}

/** The CRT on its cabinet. The screen itself is left dark: the video sits on top of it. */
function tvSet(ctx: Ctx) {
  const sc = SCREENS.tv;
  // Cabinet
  rect(ctx, "rgba(0,0,0,0.3)", 112, 144, 120, 4);
  rect(ctx, INK, 110, 112, 118, 34);
  rect(ctx, WOOD, 112, 114, 114, 30);
  rect(ctx, WOOD_LIGHT, 112, 114, 114, 1);
  rect(ctx, WOOD_DARK, 112, 128, 114, 1);
  rect(ctx, WOOD_DARK, 168, 114, 1, 30);
  for (const [x, y] of [
    [160, 120],
    [174, 120],
    [160, 135],
    [174, 135],
  ] as const)
    rect(ctx, GOLD, x, y, 3, 1);
  // Set
  rect(ctx, INK, 117, 43, 102, 70);
  rect(ctx, "#cfc6b4", 118, 44, 100, 68);
  rect(ctx, "#e2dbcc", 118, 44, 100, 2);
  rect(ctx, "#b5ad9b", 118, 109, 100, 3);
  rect(ctx, INK, sc.x - 2, sc.y - 2, sc.w + 4, sc.h + 4);
  rect(ctx, "#22303f", sc.x, sc.y, sc.w, sc.h);
  // Knobs and the speaker grille
  rect(ctx, INK, 206, 52, 9, 9);
  rect(ctx, GOLD, 210, 55, 2, 2);
  rect(ctx, INK, 206, 65, 9, 9);
  rect(ctx, GOLD, 210, 68, 2, 2);
  for (let i = 0; i < 7; i++) rect(ctx, "#9a917f", 205, 79 + i * 3, 11, 1);
  // Little label under the screen and a power light
  rect(ctx, "#9a917f", 156, 101, 16, 2);
  rect(ctx, "#ff5a4a", 198, 102, 2, 2);
  // Rabbit ears
  rect(ctx, INK, 160, 40, 16, 3);
  for (let i = 1; i <= 22; i++) {
    rect(ctx, INK, 164 - Math.round(i * 0.8), 40 - i, 1, 1);
    rect(ctx, INK, 172 + Math.round(i * 0.8), 40 - i, 1, 1);
  }
  rect(ctx, "#c0c6cc", 145, 16, 3, 3);
  rect(ctx, "#c0c6cc", 189, 16, 3, 3);
}

/** The twin's head from behind, headphones on, watching with you. */
function headFromBehind(ctx: Ctx, cx: number, cy: number) {
  const P = TWIN_PALETTE;
  // Shoulders
  rect(ctx, P.o, cx - 24, cy + 10, 48, 20);
  rect(ctx, P.c, cx - 23, cy + 11, 46, 20);
  rect(ctx, P.d, cx - 23, cy + 11, 46, 2);
  rect(ctx, P.s, cx - 4, cy + 8, 8, 4);
  // Head
  disc(ctx, cx, cy, 14, P.o);
  disc(ctx, cx, cy, 13, P.h);
  for (let i = 0; i < 9; i++) rect(ctx, "#2c2533", cx - 9 + Math.floor(rand(i, 3, 9) * 18), cy - 8 + Math.floor(rand(i, 4, 9) * 16), 3, 1);
  // Headphone band and cups
  for (let dx = -12; dx <= 12; dx++) {
    const dy = Math.round(-Math.sqrt(Math.max(0, 15 * 15 - dx * dx)));
    rect(ctx, PHONE_COLOURS.b, cx + dx, cy + dy, 1, 3);
  }
  rect(ctx, PHONE_COLOURS.g, cx - 6, cy - 15, 12, 1);
  for (const sx of [cx - 18, cx + 13]) {
    rect(ctx, PHONE_COLOURS.b, sx, cy - 4, 5, 11);
    rect(ctx, PHONE_COLOURS.g, sx + 1, cy - 3, 1, 9);
  }
}

// ───────────────────────────── the couch (from the TV) ─────────────────────────────

const COUCH_L = 76;
const COUCH_R = 236;
const TWIN_CX = 156;
const HEAD_TOP = 60;

/** The twin and the couch are drawn twice as big as the wall behind them: he's close, the wall isn't. */
const NEAR = 2;
/** Where his head's top lands in the frame. */
const NEAR_TOP = 44;

function couchView(ctx: Ctx, b: Bounds, sky: Sky, f: FaceFrame, pose: Pose) {
  const floorY = 150;
  room(ctx, b, floorY, "wood");
  const lit = sky === "night" || sky === "dusk";

  // The partition wall behind the couch: the doorway to the front room straight behind him (as in
  // the room, where it lines up with his seat), red couplets beside it, a poster either side.
  doorway(ctx, 132, 18, 56, sky);
  couplet(ctx, 118, 34);
  couplet(ctx, 194, 34);
  posterBlonde(ctx, 64, 24);
  posterViews(ctx, 220, 24);
  bamboo(ctx, 14, floorY);
  palm(ctx, 312, floorY);
  if (lit) rect(ctx, "rgba(255, 190, 90, 0.08)", b.l, 0, b.r - b.l, floorY);

  ctx.save();
  ctx.translate(160, NEAR_TOP);
  ctx.scale(NEAR, NEAR);
  ctx.translate(-TWIN_CX, -HEAD_TOP);
  couchFront(ctx, floorY);
  twinFront(ctx, f, pose);
  couchArms(ctx);
  ctx.restore();
}

function bamboo(ctx: Ctx, x: number, floorY: number) {
  for (const [dx, top] of [
    [2, 66],
    [7, 54],
    [12, 74],
  ] as const) {
    rect(ctx, "#7cb342", x + dx, top, 3, floorY - 20 - top);
    for (let y = top + 6; y < floorY - 20; y += 9) rect(ctx, "#558b2f", x + dx, y, 3, 1);
    rect(ctx, "#8bc34a", x + dx + 3, top + 2, 5, 2);
    rect(ctx, "#8bc34a", x + dx - 4, top + 10, 4, 2);
  }
  rect(ctx, INK, x - 2, floorY - 22, 22, 22);
  rect(ctx, "#2f6db5", x - 1, floorY - 21, 20, 20);
  rect(ctx, WHITE, x - 1, floorY - 16, 20, 2);
  rect(ctx, WHITE, x + 7, floorY - 11, 4, 4);
}

function palm(ctx: Ctx, x: number, floorY: number) {
  for (const [dx, dy, w] of [
    [-22, -62, 12],
    [-4, -62, 12],
    [-18, -72, 10],
    [-6, -72, 10],
    [-13, -78, 8],
    [-26, -52, 12],
    [0, -52, 12],
  ] as const)
    rect(ctx, dy < -66 ? "#6dbb5b" : "#4f9d4a", x + dx, floorY + dy, w, 5);
  rect(ctx, "#3a7a3a", x - 10, floorY - 70, 3, 48);
  rect(ctx, INK, x - 20, floorY - 24, 22, 24);
  rect(ctx, "#2f6db5", x - 19, floorY - 23, 20, 22);
  rect(ctx, WHITE, x - 19, floorY - 18, 20, 2);
}

/**
 * Frank Ocean's Blonde, as a pixel homage: green hair, both hands over his face, in the shower
 * against pale tiles (after Wolfgang Tillmans' photograph).
 */
function posterBlonde(ctx: Ctx, x: number, y: number) {
  const w = 36;
  const h = 48;
  posterFrame(ctx, x, y, w, h);
  // Shower tiles, steamed up toward the top.
  rect(ctx, "#e4ecec", x, y, w, h);
  for (let gx = x + 4; gx < x + w; gx += 6) rect(ctx, "#c9d6d8", gx, y, 1, h);
  for (let gy = y + 5; gy < y + h; gy += 6) rect(ctx, "#c9d6d8", x, gy, w, 1);
  rect(ctx, "rgba(255,255,255,0.45)", x, y, w, 10);
  const cx = x + 20;
  const SKIN = "#8a5638";
  const SKIN_HI = "#a8704c";
  const SKIN_LO = "#6a3e27";
  // Bare shoulders at the bottom of the frame.
  rect(ctx, SKIN, x + 2, y + 38, w - 4, h - 38);
  rect(ctx, SKIN_HI, x + 20, y + 39, 9, 1);
  rect(ctx, SKIN, cx - 4, y + 30, 9, 9);
  rect(ctx, SKIN_LO, cx - 4, y + 30, 9, 1);
  // Head, and the green hair.
  disc(ctx, cx, y + 21, 10, SKIN_LO);
  disc(ctx, cx, y + 21, 9, SKIN);
  disc(ctx, cx, y + 14, 9, "#5f9a2a", -9, 0);
  disc(ctx, cx, y + 14, 8, "#8cc63f", -8, -1);
  for (let i = 0; i < 7; i++) rect(ctx, "#b6e06a", cx - 7 + Math.floor(rand(i, 1, 21) * 14), y + 6 + Math.floor(rand(i, 2, 21) * 7), 2, 1);
  for (const dx of [-8, -4, 0, 4, 7]) rect(ctx, "#8cc63f", cx + dx, y + 4 + Math.round(Math.abs(dx) / 3), 2, 2);
  // The lower face shows under his hand: nose, closed mouth, chin.
  rect(ctx, SKIN_LO, cx + 1, y + 23, 1, 2);
  rect(ctx, SKIN_LO, cx - 1, y + 27, 4, 1);
  rect(ctx, SKIN_HI, cx + 4, y + 22, 2, 3);
  // One arm, whole: up from the shoulder, elbow out to the side, hand flat over his eyes with the
  // fingers reaching into his hair. The other hand isn't in the picture.
  const arm = (pts: [number, number][], r: number, color: string) => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]!;
      const [x1, y1] = pts[i]!;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) {
        const px = Math.round(x0 + ((x1 - x0) * k) / n);
        const py = Math.round(y0 + ((y1 - y0) * k) / n);
        rect(ctx, color, x + px - r, y + py - r, r * 2 + 1, r * 2 + 1);
      }
    }
  };
  const path: [number, number][] = [
    [8, 46],
    [5, 31],
    [12, 21],
    [cx - x - 6, 18],
  ];
  arm(path, 3, SKIN_LO);
  arm(path, 2, SKIN);
  rect(ctx, SKIN_HI, x + 4, y + 34, 1, 9);
  rect(ctx, SKIN_HI, x + 8, y + 24, 3, 1);
  // The hand: palm across the eyes, fingertips at the hairline, thumb down the cheek. Lighter than
  // the face, so it reads as a hand in front of it.
  rect(ctx, SKIN_LO, cx - 7, y + 15, 11, 7);
  rect(ctx, SKIN_HI, cx - 6, y + 16, 9, 5);
  for (let fx = 0; fx < 4; fx++) {
    rect(ctx, SKIN_LO, cx - 6 + fx * 2 + (fx > 1 ? 1 : 0), y + 12, 2, 4);
    rect(ctx, SKIN_HI, cx - 6 + fx * 2 + (fx > 1 ? 1 : 0), y + 13, 1, 3);
  }
  rect(ctx, SKIN_LO, cx + 3, y + 19, 2, 5);
  rect(ctx, SKIN_HI, cx + 3, y + 20, 1, 3);
  // Water drops on the tiles.
  for (const [dx, dy] of [
    [4, 12],
    [30, 8],
    [31, 26],
    [3, 30],
  ] as const)
    rect(ctx, "#ffffff", x + dx, y + dy, 1, 2);
}

/**
 * Drake's Views, as a pixel homage: a tiny Drake sitting on the edge of the CN Tower, high above a
 * grey Toronto.
 */
function posterViews(ctx: Ctx, x: number, y: number) {
  const w = 36;
  const h = 48;
  posterFrame(ctx, x, y, w, h);
  // Overcast sky, darker overhead.
  const bands = ["#7d868e", "#8d959c", "#9ca3a9", "#acb2b7", "#bcc1c5", "#c9cdd0"];
  bands.forEach((c, i) => rect(ctx, c, x, y + i * 6, w, 6));
  rect(ctx, "#c9cdd0", x, y + 36, w, h - 36);
  // The city far below.
  for (let bx = x; bx < x + w; ) {
    const bw = 2 + Math.floor(rand(bx, 1, 30) * 4);
    const bh = 3 + Math.floor(rand(bx, 2, 30) * 7);
    rect(ctx, rand(bx, 3, 30) < 0.5 ? "#5a6068" : "#4a5058", bx, y + h - bh, bw, bh);
    if (rand(bx, 4, 30) < 0.5) rect(ctx, "#d8d0a0", bx + 1, y + h - bh + 2, 1, 1);
    bx += bw;
  }
  rect(ctx, "#6d757d", x, y + h - 2, w, 2);
  // The tower: the shaft, the main pod, the SkyPod, the antenna.
  const tx = x + 12;
  rect(ctx, "#3c4046", tx, y + 24, 4, h - 24);
  rect(ctx, "#5a5f66", tx + 1, y + 24, 1, h - 24);
  rect(ctx, "#2e3238", tx - 5, y + 20, 14, 5);
  rect(ctx, "#4a4f56", tx - 6, y + 21, 16, 2);
  rect(ctx, "#3c4046", tx + 1, y + 9, 2, 11);
  rect(ctx, "#2e3238", tx - 1, y + 12, 6, 3);
  rect(ctx, "#3c4046", tx + 1, y + 1, 1, 8);
  // Drake, sitting on the ledge with his legs over the edge.
  const dx = tx + 9;
  rect(ctx, "#141414", dx, y + 16, 2, 2);
  rect(ctx, "#141414", dx - 1, y + 18, 3, 3);
  rect(ctx, "#141414", dx + 1, y + 21, 1, 2);
  rect(ctx, "#141414", dx + 2, y + 21, 1, 3);
}

function posterFrame(ctx: Ctx, x: number, y: number, w: number, h: number) {
  rect(ctx, "rgba(0,0,0,0.22)", x + 2, y + 2, w + 2, h + 2);
  rect(ctx, INK, x - 1, y - 1, w + 2, h + 2);
  // Tape at the corners.
  rect(ctx, "rgba(255, 246, 200, 0.85)", x - 3, y - 2, 6, 3);
  rect(ctx, "rgba(255, 246, 200, 0.85)", x + w - 3, y - 2, 6, 3);
}

/** The doorway to the front room, and straight through it the open front door: the street, and the sky. */
function doorway(ctx: Ctx, x: number, y: number, w: number, sky: Sky) {
  const floorY = 150;
  const s = SKIES[sky];
  rect(ctx, BEAM_DARK, x - 3, y - 3, w + 6, floorY - y + 3);
  rect(ctx, BEAM, x - 4, y - 5, w + 8, 4);
  // Far ceiling, far wall, cement tiles running toward the front door.
  rect(ctx, "#3a2416", x, y, w, 10);
  rect(ctx, OCHRE_SHADE, x, y + 10, w, 72);
  rect(ctx, "#c9963a", x, y + 10, w, 2);
  for (let ty = y + 82, row = 0; ty < floorY; ty += 3 + row, row++) {
    rect(ctx, TILE_BASE, x, ty, w, 3 + row);
    for (let tx = x + (row % 2) * 3; tx < x + w; tx += 6) rect(ctx, row % 2 ? TILE_RED : TILE_TEAL, tx, ty + 1, 2, 1);
  }
  // The front door, open to the street.
  const dx = x + Math.floor(w / 2) - 5;
  const dy = y + 40;
  rect(ctx, BEAM_DARK, dx - 2, dy - 2, 14, 44);
  rect(ctx, s.top, dx, dy, 10, 16);
  rect(ctx, s.bottom, dx, dy + 16, 10, 10);
  rect(ctx, sky === "night" ? "#2e5a35" : "#4f9d4a", dx, dy + 26, 10, 14);
  if (sky === "night") rect(ctx, "#fff3c4", dx + 6, dy + 3, 2, 2);
  else if (sky === "day") rect(ctx, "#fff3a0", dx + 6, dy + 3, 2, 2);
  // The desk's monitor glows in the corner of the front room.
  rect(ctx, INK, x + 1, y + 58, 7, 6);
  rect(ctx, "#7dffb0", x + 2, y + 59, 5, 4);
  rect(ctx, "rgba(125, 255, 176, 0.15)", x, y + 52, 14, 18);
  // Door frame
  rect(ctx, BEAM_DARK, x - 3, y - 3, 3, floorY - y + 3);
  rect(ctx, BEAM_DARK, x + w, y - 3, 3, floorY - y + 3);
}

function couchFront(ctx: Ctx, floorY: number) {
  const w = COUCH_R - COUCH_L;
  rect(ctx, "rgba(0,0,0,0.25)", COUCH_L - 8, floorY - 2, w + 16, 6);
  // Backrest, behind the twin.
  rect(ctx, INK, COUCH_L, 97, w, 34);
  rect(ctx, COUCH, COUCH_L + 1, 98, w - 2, 32);
  rect(ctx, COUCH_LIGHT, COUCH_L + 1, 98, w - 2, 2);
  for (const i of [1, 2]) rect(ctx, COUCH_DARK, COUCH_L + Math.round((w * i) / 3), 100, 1, 30);
  for (let i = 0; i < 3; i++) rect(ctx, COUCH_DARK, COUCH_L + Math.round((w * (i + 0.5)) / 3), 112, 2, 2);
  // Throw pillows
  for (const [px, col, shade] of [
    [COUCH_L + 6, "#c4473d", "#a8322d"],
    [COUCH_R - 30, GOLD, "#c49530"],
  ] as const) {
    rect(ctx, INK, px, 104, 24, 24);
    rect(ctx, col, px + 1, 105, 22, 22);
    rect(ctx, shade, px + 1, 124, 22, 3);
    rect(ctx, shade, px + 11, 115, 2, 2);
  }
  // Seat cushions and the base.
  rect(ctx, INK, COUCH_L, 130, w, 14);
  rect(ctx, COUCH_LIGHT, COUCH_L + 1, 131, w - 2, 2);
  rect(ctx, COUCH, COUCH_L + 1, 133, w - 2, 10);
  for (const i of [1, 2]) rect(ctx, COUCH_DARK, COUCH_L + Math.round((w * i) / 3), 131, 1, 12);
  rect(ctx, INK, COUCH_L, 144, w, floorY - 147);
  rect(ctx, COUCH_DARK, COUCH_L + 1, 144, w - 2, floorY - 148);
  for (const lx of [COUCH_L + 6, COUCH_R - 9]) rect(ctx, BEAM_DARK, lx, floorY - 3, 3, 4);
}

function couchArms(ctx: Ctx) {
  for (const ax of [COUCH_L - 12, COUCH_R - 2]) {
    rect(ctx, INK, ax, 104, 14, 44);
    rect(ctx, COUCH_DARK, ax + 1, 105, 12, 42);
    rect(ctx, COUCH, ax + 1, 105, 12, 7);
    rect(ctx, COUCH_LIGHT, ax + 2, 105, 10, 2);
    rect(ctx, COUCH_DARK, ax + 3, 110, 8, 1);
  }
}

/**
 * The twin facing you, sitting on the couch with his headphones on. Built from the same palette as
 * his sprite, so it's the same character up close. `f` moves his mouth and eyes.
 */
function twinFront(ctx: Ctx, f: FaceFrame, pose: Pose) {
  const P = TWIN_PALETTE;
  const cx = TWIN_CX;
  const top = HEAD_TOP;
  const SKIN_LO = "#d9a37f";

  // Legs: thighs on the seat toward you, shins down the front of the couch, feet on the floor.
  for (const side of [-1, 1]) {
    const lx = side < 0 ? cx - 15 : cx + 2;
    rect(ctx, P.o, lx - 1, 124, 15, 20);
    rect(ctx, P.p, lx, 125, 13, 18);
    rect(ctx, "#26304c", lx, 140, 13, 2);
    rect(ctx, P.o, lx, 143, 13, 4);
    rect(ctx, P.p, lx + 1, 143, 11, 3);
    rect(ctx, P.o, lx - 1, 146, 15, 5);
    rect(ctx, "#f2f2f2", lx, 147, 13, 3);
  }
  // Torso
  rect(ctx, P.o, cx - 19, top + 32, 38, 36);
  rect(ctx, P.c, cx - 18, top + 33, 36, 34);
  rect(ctx, "#4cc8b8", cx - 18, top + 33, 36, 2);
  rect(ctx, P.d, cx - 18, top + 62, 36, 5);
  // Collar
  rect(ctx, P.d, cx - 5, top + 33, 10, 2);
  rect(ctx, P.d, cx - 3, top + 35, 6, 2);
  rect(ctx, P.d, cx - 1, top + 37, 2, 2);
  // Arms down at his sides, hands resting on his knees (unless they're up at his headphones).
  for (const side of pose.hands ? [] : [-1, 1]) {
    const ax = side < 0 ? cx - 25 : cx + 18;
    rect(ctx, P.o, ax, top + 34, 8, 30);
    rect(ctx, P.c, ax + 1, top + 35, 6, 14);
    rect(ctx, P.s, ax + 1, top + 49, 6, 14);
    rect(ctx, SKIN_LO, ax + (side < 0 ? 6 : 1), top + 49, 1, 14);
    const hx = side < 0 ? cx - 20 : cx + 12;
    rect(ctx, P.o, hx, top + 63, 9, 7);
    rect(ctx, P.s, hx + 1, top + 64, 7, 5);
  }
  // Neck
  rect(ctx, P.o, cx - 5, top + 26, 10, 7);
  rect(ctx, SKIN_LO, cx - 4, top + 26, 8, 6);

  // Ears (under the cups while the headphones are on), then the face, hair on top.
  for (const ex of [cx - 15, cx + 11]) {
    rect(ctx, P.o, ex, top + 12, 4, 9);
    rect(ctx, P.s, ex + 1, top + 13, 2, 7);
  }
  rect(ctx, P.o, cx - 12, top + 4, 24, 24);
  rect(ctx, P.o, cx - 10, top + 28, 20, 1);
  rect(ctx, P.s, cx - 11, top + 7, 22, 20);
  rect(ctx, P.s, cx - 9, top + 27, 18, 1);
  rect(ctx, SKIN_LO, cx - 11, top + 24, 2, 3);
  rect(ctx, SKIN_LO, cx + 9, top + 24, 2, 3);
  // Hair, with a fringe
  rect(ctx, P.o, cx - 13, top + 1, 26, 6);
  rect(ctx, P.o, cx - 10, top, 20, 1);
  rect(ctx, P.h, cx - 12, top + 1, 24, 7);
  rect(ctx, P.h, cx - 11, top + 8, 6, 2);
  rect(ctx, P.h, cx - 3, top + 8, 4, 3);
  rect(ctx, P.h, cx + 4, top + 8, 7, 2);
  rect(ctx, "#2c2533", cx - 6, top + 3, 8, 1);
  if (pose.phones === "head" || pose.phones === "lifted") headphones(ctx, cx, top, pose.phones);

  // Eyebrows, eyes (looking where `f.look` says), nose, cheeks.
  rect(ctx, P.h, cx - 8, top + 12, 5, 1);
  rect(ctx, P.h, cx + 3, top + 12, 5, 1);
  for (const ex of [cx - 7, cx + 4]) {
    if (f.blink) rect(ctx, P.e, ex, top + 16, 3, 1);
    else {
      rect(ctx, "#ffffff", ex, top + 14, 3, 3);
      rect(ctx, P.e, ex + 1 + f.look, top + 14, 2, 3);
      rect(ctx, "#ffffff", ex + 1 + f.look, top + 14, 1, 1);
    }
  }
  rect(ctx, SKIN_LO, cx, top + 18, 1, 3);
  rect(ctx, SKIN_LO, cx - 1, top + 21, 3, 1);
  rect(ctx, "#f59e9e", cx - 9, top + 20, 3, 1);
  rect(ctx, "#f59e9e", cx + 6, top + 20, 3, 1);

  // Mouth: closed (a small smile), half open, open.
  const my = top + 23;
  if (f.mouth === 0) {
    rect(ctx, P.m, cx - 2, my, 5, 1);
    rect(ctx, P.m, cx - 3, my - 1, 1, 1);
    rect(ctx, P.m, cx + 3, my - 1, 1, 1);
  } else if (f.mouth === 1) {
    rect(ctx, P.m, cx - 2, my - 1, 5, 3);
    rect(ctx, "#5a2230", cx - 1, my, 3, 1);
  } else {
    rect(ctx, P.m, cx - 3, my - 1, 7, 4);
    rect(ctx, "#ffffff", cx - 2, my, 5, 1);
    rect(ctx, "#5a2230", cx - 2, my + 1, 5, 1);
    rect(ctx, "#e07a7a", cx - 1, my + 1, 3, 1);
  }

  if (pose.phones === "jaw" || pose.phones === "neck") headphones(ctx, cx, top, pose.phones);
  if (pose.hands) {
    // Both hands on the cups, elbows out.
    const cups = cupCentres(cx, top, pose.phones);
    for (const [side, [hx, hy]] of [
      [-1, cups[0]],
      [1, cups[1]],
    ] as const) {
      const shoulder: [number, number] = [cx + side * 18, top + 38];
      const elbow: [number, number] = [cx + side * 27, Math.max(hy + 12, top + 30)];
      const hand: [number, number] = [hx, hy + 2];
      thick(ctx, [shoulder, elbow, hand], 3, P.o);
      thick(ctx, [shoulder, elbow], 2, P.c);
      thick(ctx, [elbow, hand], 2, P.s);
      rect(ctx, P.o, hx - 3, hy - 3, 7, 8);
      rect(ctx, P.s, hx - 2, hy - 2, 5, 6);
      rect(ctx, SKIN_LO, hx - 2, hy + 3, 5, 1);
    }
  }
}

/** A line 2r+1 pixels thick through `pts`, stamped square by square so it stays crisp. */
function thick(ctx: Ctx, pts: [number, number][], r: number, color: string) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const n = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) rect(ctx, color, Math.round(x0 + ((x1 - x0) * k) / n) - r, Math.round(y0 + ((y1 - y0) * k) / n) - r, r * 2 + 1, r * 2 + 1);
  }
}

/** Where each headphone cup sits (left, right): on his ears, lifted, by his jaw, at his collar. */
function cupCentres(cx: number, top: number, at: Pose["phones"]): [[number, number], [number, number]] {
  if (at === "head") return [[cx - 13, top + 16], [cx + 14, top + 16]];
  if (at === "lifted") return [[cx - 15, top + 10], [cx + 16, top + 10]];
  if (at === "jaw") return [[cx - 14, top + 25], [cx + 15, top + 25]];
  return [[cx - 10, top + 35], [cx + 10, top + 35]];
}

function headphones(ctx: Ctx, cx: number, top: number, at: Pose["phones"]) {
  const { b, g } = PHONE_COLOURS;
  if (at === "head" || at === "lifted") {
    // Band over the top, cups over the ears. Lifted, everything rises and spreads a little.
    const dy = at === "lifted" ? -6 : 0;
    const spread = at === "lifted" ? 2 : 0;
    rect(ctx, b, cx - 10, top - 3 + dy, 20, 3);
    rect(ctx, b, cx - 13 - spread, top - 1 + dy, 4, 3);
    rect(ctx, b, cx + 9 + spread, top - 1 + dy, 4, 3);
    rect(ctx, g, cx - 6, top - 2 + dy, 12, 1);
    for (const [sx, side] of [
      [cx - 16 - spread, -1],
      [cx + 11 + spread, 1],
    ] as const) {
      rect(ctx, b, sx, top + 2 + dy, 2, 10);
      rect(ctx, b, sx - 1, top + 11 + dy, 7, 11);
      rect(ctx, g, sx + (side < 0 ? 0 : 4), top + 12 + dy, 1, 9);
    }
    return;
  }
  const cups = cupCentres(cx, top, at);
  if (at === "jaw") {
    // On the way down: the band is behind his head, the cups beside his jaw.
    for (const [x, y] of cups) {
      rect(ctx, b, x - 3, y - 5, 7, 11);
      rect(ctx, g, x - 2, y - 4, 1, 9);
    }
    return;
  }
  // Around his neck: the band runs behind it, the cups rest on his collarbones.
  rect(ctx, b, cx - 9, top + 29, 4, 3);
  rect(ctx, b, cx + 5, top + 29, 4, 3);
  for (const [x, y] of cups) {
    rect(ctx, b, x - 4, y - 3, 9, 6);
    rect(ctx, g, x - 3, y - 2, 7, 1);
  }
}

// ───────────────────────────── the desk ─────────────────────────────

function deskView(ctx: Ctx, b: Bounds) {
  const deskY = 140;
  room(ctx, b, deskY + 8, "none");
  // Hornets flag on the wall, top right.
  // The Hornets flag: in the room it's wider than the monitor, so up close it's as big as the
  // monitor too, hanging on the wall just past it with the logo at triple size.
  flag(ctx, 210, 10, 104, 80, "#1d1160", (x, y, w, hh) => {
    rect(ctx, "#00788c", x, y, w, 7);
    rect(ctx, "#00788c", x, y + hh - 7, w, 7);
    rect(ctx, "#f28c28", x, y + 7, w, 1);
    rect(ctx, "#f28c28", x, y + hh - 8, w, 1);
    bitmapK(ctx, HORNETS_LOGO, x + Math.floor((w - 57) / 2), y + Math.floor((hh - 45) / 2), { w: "#ffffff", k: "#0d0a1f", t: "#00a3ad", p: "#6a5acd", e: "#ffffff", o: "#f28c28", l: "#8a3c10" }, 3);
  });
  // Sticky notes on the wall beside the monitor.
  for (const [x, y, c] of [
    [14, 24, "#fff6b8"],
    [22, 40, "#ffd1dc"],
    [12, 56, "#cfe8ff"],
  ] as const) {
    rect(ctx, c, x, y, 12, 12);
    rect(ctx, "rgba(0,0,0,0.15)", x + 2, y + 4, 8, 1);
    rect(ctx, "rgba(0,0,0,0.15)", x + 2, y + 7, 6, 1);
  }
  // Desk top, then the lamp, the monitor, the keyboard, the mug.
  rect(ctx, INK, b.l, deskY - 1, b.r - b.l, 1);
  rect(ctx, WOOD, b.l, deskY, b.r - b.l, b.b - deskY);
  rect(ctx, WOOD_LIGHT, b.l, deskY, b.r - b.l, 2);
  for (let y = deskY + 8, gap = 6; y < b.b; y += gap, gap += 2) rect(ctx, WOOD_DARK, b.l, y, b.r - b.l, 1);
  deskLamp(ctx, 8, deskY);
  monitor(ctx);
  keyboard(ctx, 64, deskY + 10);
  rect(ctx, INK, 268, deskY - 20, 18, 22);
  rect(ctx, WHITE, 269, deskY - 19, 16, 20);
  rect(ctx, "#c4605a", 269, deskY - 13, 16, 3);
  rect(ctx, INK, 286, deskY - 15, 4, 10);
  rect(ctx, WHITE, 286, deskY - 14, 2, 8);
  rect(ctx, "#5a3420", 270, deskY - 19, 14, 2);
}

function deskLamp(ctx: Ctx, x: number, deskY: number) {
  rect(ctx, "rgba(255, 230, 150, 0.16)", x - 6, deskY - 40, 50, 40);
  rect(ctx, INK, x, deskY - 4, 20, 4);
  rect(ctx, "#2f6db5", x + 1, deskY - 3, 18, 2);
  for (let i = 0; i < 30; i++) rect(ctx, INK, x + 9 + Math.round(i * 0.3), deskY - 4 - i, 2, 1);
  for (let i = 0; i < 14; i++) rect(ctx, INK, x + 18 - i, deskY - 34 - Math.round(i * 0.4), 2, 1);
  rect(ctx, INK, x - 2, deskY - 42, 14, 8);
  rect(ctx, "#2f6db5", x - 1, deskY - 41, 12, 6);
  rect(ctx, "#fff3a0", x, deskY - 35, 10, 2);
}

function monitor(ctx: Ctx) {
  const sc = SCREENS.desk;
  rect(ctx, "rgba(0,0,0,0.25)", sc.x - 4, 132, sc.w + 16, 6);
  // Stand, under the middle of the screen
  const mid = sc.x + sc.w / 2;
  rect(ctx, INK, mid - 10, 120, 20, 14);
  rect(ctx, "#3a3a44", mid - 9, 120, 18, 13);
  rect(ctx, INK, mid - 28, 132, 56, 7);
  rect(ctx, "#3a3a44", mid - 27, 133, 54, 5);
  // Bezel
  rect(ctx, INK, sc.x - 9, sc.y - 9, sc.w + 18, sc.h + 22);
  rect(ctx, "#2a2a33", sc.x - 8, sc.y - 8, sc.w + 16, sc.h + 20);
  rect(ctx, "#3a3a44", sc.x - 8, sc.y - 8, sc.w + 16, 1);
  rect(ctx, "#0d1b14", sc.x, sc.y, sc.w, sc.h);
  // Power light and the robot sticker
  rect(ctx, "#7dffb0", sc.x + sc.w - 4, sc.y + sc.h + 6, 2, 1);
  rect(ctx, "#d5dde8", sc.x + 4, sc.y + sc.h + 3, 6, 6);
  rect(ctx, "#7df9ff", sc.x + 5, sc.y + sc.h + 4, 1, 1);
  rect(ctx, "#7df9ff", sc.x + 8, sc.y + sc.h + 4, 1, 1);
  rect(ctx, INK, sc.x + 5, sc.y + sc.h + 7, 4, 1);
}

function keyboard(ctx: Ctx, x: number, y: number) {
  rect(ctx, INK, x, y, 128, 18);
  rect(ctx, "#d5dde8", x + 1, y + 1, 126, 16);
  for (let row = 0; row < 3; row++)
    for (let k = 0; k < 15; k++) rect(ctx, "#b8c2d0", x + 4 + k * 8 + (row % 2) * 2, y + 3 + row * 4, 6, 2);
  rect(ctx, "#b8c2d0", x + 36, y + 15, 48, 2);
}

// ───────────────────────────── a canvas showing one view ─────────────────────────────

/**
 * Draws one view onto a canvas and keeps it current: on resize, every 20 s for the clock and sky,
 * and, for the couch, whenever the twin's face changes. Content in `overlay` is kept on the screen.
 */
export class PovView {
  private layout: PovLayout | null = null;
  private timer = 0;
  private running = false;
  /** When the close-up opened, for the headphones-off sequence. */
  private startedAt = 0;
  private readonly ro: ResizeObserver;
  private readonly off: () => void;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly id: PovId,
    private readonly opts: { overlay?: HTMLElement; focus?: Box; phonesOff?: boolean } = {},
  ) {
    this.ro = new ResizeObserver(() => this.resize());
    this.off = id === "couch" ? face.onChange(() => this.running && this.schedule(0)) : () => {};
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.startedAt = performance.now();
    this.ro.observe(this.canvas);
    this.resize();
  }

  stop() {
    this.running = false;
    this.ro.disconnect();
    clearTimeout(this.timer);
  }

  destroy() {
    this.stop();
    this.off();
  }

  private resize() {
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    if (!cssW || !cssH) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.layout = povLayout(cssW, cssH, dpr, this.opts.focus);
    const screen = this.id === "couch" ? null : SCREENS[this.id];
    if (this.opts.overlay && screen) {
      const r = screenBox(this.layout, screen);
      Object.assign(this.opts.overlay.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      this.opts.overlay.style.setProperty("--px", `${this.layout.s / dpr}px`);
    }
    this.frame();
  }

  /** Draw again now, e.g. after someone else resized (and so cleared) the canvas. */
  redraw() {
    if (this.running) this.resize();
  }

  private schedule(ms: number) {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.frame(), ms);
  }

  private frame() {
    if (!this.running || !this.layout) return;
    const ctx = this.canvas.getContext("2d", { alpha: false })!;
    const now = performance.now();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const since = now - this.startedAt;
    const pose = !this.opts.phonesOff ? PHONES_ON : reduced ? PHONES_OFF : phonesOffPose(since);
    drawPov(ctx, this.id, this.layout, new Date(), this.id === "couch" ? face.frame(now) : undefined, pose);
    const posing = this.opts.phonesOff && !reduced ? nextPoseIn(since) : null;
    const next = this.id === "couch" ? Math.min(face.nextChange(now), 20_000) : 20_000;
    this.schedule(posing === null ? next : Math.min(next, posing));
  }
}
