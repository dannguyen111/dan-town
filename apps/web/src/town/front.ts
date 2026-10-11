/**
 * Walking behind furniture. Objects are baked into the floor canvas, so the visitor, drawn on top, would
 * cover any art that rises above an object's tiles (a fridge's top, a cabinet's marquee). While baking, each
 * object's own pixels are kept as a separate layer; the town lays it back over a visitor standing behind it.
 */
import { TILE, type Point, type TownObject } from "./map.ts";
import { SPRITE_H, SPRITE_W } from "./sprites.ts";

type Ctx = CanvasRenderingContext2D;

export interface Front {
  obj: TownObject;
  /** The layer's top-left, in world pixels. */
  x: number;
  y: number;
  img: HTMLCanvasElement;
}

/** How far above (and beside) its tiles an object's art may reach. */
const REACH_UP = 2 * TILE;
const REACH_SIDE = 4;

const fronts = new WeakMap<HTMLCanvasElement, Front[]>();

/** The furniture layers recorded while baking `world`, if any. */
export const frontsOf = (world: HTMLCanvasElement): readonly Front[] => fronts.get(world) ?? [];

/**
 * Draw each object with `draw`, recording the pixels it changed as that object's front layer.
 * Exits (floor mats) are drawn but never layered.
 */
export function drawObjects(ctx: Ctx, objects: readonly TownObject[], draw: (ctx: Ctx, o: TownObject) => void) {
  const list: Front[] = [];
  const { width: cw, height: ch } = ctx.canvas;
  for (const o of objects) {
    const x = Math.max(0, o.x * TILE - REACH_SIDE);
    const y = Math.max(0, o.y * TILE - REACH_UP);
    const w = Math.min(cw, (o.x + o.w) * TILE + REACH_SIDE) - x;
    const h = Math.min(ch, (o.y + o.h) * TILE) - y;
    const layered = o.kind !== "exit" && o.style !== "exit" && w > 0 && h > 0;
    let before: ImageData | null = null;
    try {
      if (layered) before = ctx.getImageData(x, y, w, h);
    } catch {
      // A tainted canvas can't be read; the object just won't layer.
    }
    draw(ctx, o);
    if (before) {
      const front = diff(before, ctx.getImageData(x, y, w, h), x, y);
      if (front) list.push({ obj: o, ...front });
    }
  }
  fronts.set(ctx.canvas, [...(fronts.get(ctx.canvas) ?? []), ...list]);
}

/** The pixels that changed between `a` and `b`, cropped to their bounds, or null if none did. */
function diff(a: ImageData, b: ImageData, ox: number, oy: number): Omit<Front, "obj"> | null {
  const { width: w, height: h } = a;
  const out = new ImageData(w, h);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] === b.data[i] && a.data[i + 1] === b.data[i + 1] && a.data[i + 2] === b.data[i + 2] && a.data[i + 3] === b.data[i + 3]) continue;
    out.data.set(b.data.subarray(i, i + 4), i);
    const p = i / 4;
    const px = p % w;
    const py = (p - px) / w;
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
  }
  if (x1 < 0) return null;
  const img = document.createElement("canvas");
  img.width = x1 - x0 + 1;
  img.height = y1 - y0 + 1;
  img.getContext("2d")!.putImageData(out, -x0, -y0);
  return { x: ox + x0, y: oy + y0, img };
}

/**
 * Whether the visitor's sprite, standing at `p` (world pixels, a tile's top-left), is behind `f`'s object
 * and overlaps its art.
 */
export function isBehind(p: Point, f: Front): boolean {
  if (p.y >= f.obj.y * TILE) return false;
  const sx = p.x + (TILE - SPRITE_W) / 2;
  const sy = p.y + TILE - SPRITE_H - 1;
  return sx < f.x + f.img.width && sx + SPRITE_W > f.x && sy < f.y + f.img.height && p.y + TILE > f.y;
}
