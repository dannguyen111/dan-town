/**
 * Character sprites as tiny text bitmaps (12×18). Each letter maps to a palette colour.
 * Sprites are baked once into offscreen canvases at startup, so a frame costs one drawImage.
 */
import type { Dir } from "./grid.ts";

export const SPRITE_W = 12;
export const SPRITE_H = 18;

type Bitmap = readonly string[];

const HEAD_DOWN: Bitmap = [
  "...oooooo...",
  "..ohhhhhho..",
  ".ohhhhhhhho.",
  ".ohhhhhhhho.",
  ".ohhsssssho.",
  ".ossessesso.",
  ".ospssssspo.",
  "..ossmmsso..",
  "...oossoo...",
];
const HEAD_UP: Bitmap = [
  "...oooooo...",
  "..ohhhhhho..",
  ".ohhhhhhhho.",
  ".ohhhhhhhho.",
  ".ohhhhhhhho.",
  ".ohhhhhhhho.",
  ".ohhhhhhhho.",
  "..ohhhhhho..",
  "...oossoo...",
];
const HEAD_RIGHT: Bitmap = [
  "...oooooo...",
  "..ohhhhhhoo.",
  ".ohhhhhhhhho",
  ".ohhhhhhhhho",
  ".ohhhhsssso.",
  ".ohhhssseso.",
  ".ohhhsssspo.",
  "..ohhssmso..",
  "...oossoo...",
];
const BODY_FRONT: Bitmap = [
  "..occcccco..",
  ".occcccccco.",
  "osccccccccso",
  "osccccccccso",
  ".oddddddddo.",
  "..oppppppo..",
];
const BODY_SIDE: Bitmap = [
  "...occcco...",
  "...occccco..",
  "...ocsccco..",
  "...ocsccco..",
  "...odddddo..",
  "...oppppo...",
];
const LEGS_FRONT: [Bitmap, Bitmap, Bitmap] = [
  ["..oppo.oppo.", "..oppo.oppo.", "..okko.okko."],
  ["..oppo.oppo.", "..okko.oppo.", "...oo..okko."],
  ["..oppo.oppo.", "..oppo.okko.", "..okko..oo.."],
];
const LEGS_SIDE: [Bitmap, Bitmap, Bitmap] = [
  ["...oppppo...", "...oppppo...", "...okkkkko.."],
  ["..opo..opo..", ".opo....opo.", ".okko...okko"],
  ["...oppopo...", "...okkopo...", "......okko.."],
];

export interface Palette {
  o: string; // outline
  h: string; // hair
  s: string; // skin
  e: string; // eyes
  p: string; // pants / cheeks
  m: string; // mouth
  c: string; // shirt
  d: string; // shirt hem
  k: string; // shoes
}

/** Visitor: cheerful orange hoodie. */
export const PLAYER_PALETTE: Palette = {
  o: "#3b2a2a", h: "#5b3a29", s: "#f6c9a3", e: "#2b2233", p: "#41507f",
  m: "#c4605a", c: "#ff8a5b", d: "#e06a3e", k: "#2b2233",
};
/** Dan's digital twin: dark hair, teal shirt. */
export const TWIN_PALETTE: Palette = {
  o: "#2b2233", h: "#1f1a24", s: "#efc19c", e: "#1f1a24", p: "#2f3b5c",
  m: "#b3544f", c: "#2bb3a3", d: "#1f8f82", k: "#1f1a24",
};

export function compose(dir: Dir, frame: 0 | 1 | 2): Bitmap {
  if (dir === "down") return [...HEAD_DOWN, ...BODY_FRONT, ...LEGS_FRONT[frame]];
  if (dir === "up") return [...HEAD_UP, ...BODY_FRONT, ...LEGS_FRONT[frame]];
  return [...HEAD_RIGHT, ...BODY_SIDE, ...LEGS_SIDE[frame]]; // "left" is mirrored at bake time
}

export type SpriteSheet = Record<Dir, [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement]>;

export function bakeSprites(palette: Palette): SpriteSheet {
  const bake = (dir: Dir, frame: 0 | 1 | 2) => {
    const c = document.createElement("canvas");
    c.width = SPRITE_W;
    c.height = SPRITE_H;
    const ctx = c.getContext("2d")!;
    const rows = compose(dir === "left" ? "right" : dir, frame);
    rows.forEach((row, y) => {
      for (let x = 0; x < SPRITE_W; x++) {
        const ch = row[dir === "left" ? SPRITE_W - 1 - x : x];
        if (!ch || ch === ".") continue;
        // In body rows, "p" means pants; in head rows it means blush.
        const colour = ch === "p" && y < 9 ? "#f59e9e" : palette[ch as keyof Palette];
        ctx.fillStyle = colour;
        ctx.fillRect(x, y, 1, 1);
      }
    });
    return c;
  };
  const dirs: Dir[] = ["down", "up", "left", "right"];
  return Object.fromEntries(dirs.map((d) => [d, [bake(d, 0), bake(d, 1), bake(d, 2)]])) as SpriteSheet;
}
