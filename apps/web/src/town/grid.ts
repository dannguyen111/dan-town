import { GROUND, OBJECTS, type Point, type TownObject } from "./map.ts";

export type Dir = "up" | "down" | "left" | "right";

export const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const DIRS = Object.keys(DELTA) as Dir[];

export const dirBetween = (a: Point, b: Point): Dir =>
  b.x > a.x ? "right" : b.x < a.x ? "left" : b.y > a.y ? "down" : "up";

/** Ground tiles nobody can walk on: trees, water, and interior walls. */
const SOLID_TILES = new Set(["T", "~", "#"]);

/** Collision, objects and pathfinding for a tile map (the town, or a building's interior). */
export class TownGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly solid: boolean[];
  private readonly objectIndex: (TownObject | undefined)[];
  private readonly doors = new Map<number, TownObject>();

  constructor(
    readonly objects: readonly TownObject[] = OBJECTS,
    ground: readonly string[] = GROUND,
  ) {
    this.cols = ground[0]!.length;
    this.rows = ground.length;
    this.solid = new Array<boolean>(this.cols * this.rows).fill(false);
    this.objectIndex = new Array<TownObject | undefined>(this.cols * this.rows).fill(undefined);

    ground.forEach((row, y) => {
      for (let x = 0; x < this.cols; x++) {
        if (SOLID_TILES.has(row[x]!)) this.solid[this.key(x, y)] = true;
      }
    });

    for (const o of objects) {
      for (let y = o.y; y < o.y + o.h; y++) {
        for (let x = o.x; x < o.x + o.w; x++) {
          this.solid[this.key(x, y)] = true;
          this.objectIndex[this.key(x, y)] = o;
        }
      }
      if (o.door) {
        this.solid[this.key(o.door.x, o.door.y)] = false;
        this.doors.set(this.key(o.door.x, o.door.y), o);
      }
    }
  }

  private key(x: number, y: number) {
    return y * this.cols + x;
  }

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  isWalkable(x: number, y: number) {
    return this.inBounds(x, y) && !this.solid[this.key(x, y)];
  }

  /** The object occupying a tile (including its door tile). */
  objectAt(x: number, y: number): TownObject | undefined {
    if (!this.inBounds(x, y)) return undefined;
    return this.doors.get(this.key(x, y)) ?? this.objectIndex[this.key(x, y)];
  }

  doorAt(x: number, y: number): TownObject | undefined {
    return this.inBounds(x, y) ? this.doors.get(this.key(x, y)) : undefined;
  }

  /** Shortest 4-directional path (excluding `from`, including `to`). Returns null if unreachable. */
  findPath(from: Point, to: Point): Point[] | null {
    if (!this.isWalkable(to.x, to.y)) return null;
    if (from.x === to.x && from.y === to.y) return [];
    const prev = new Int32Array(this.cols * this.rows).fill(-1);
    const start = this.key(from.x, from.y);
    const goal = this.key(to.x, to.y);
    prev[start] = start;
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head]!;
      if (cur === goal) break;
      const cx = cur % this.cols;
      const cy = (cur - cx) / this.cols;
      for (const d of DIRS) {
        const nx = cx + DELTA[d].x;
        const ny = cy + DELTA[d].y;
        if (!this.isWalkable(nx, ny)) continue;
        const k = this.key(nx, ny);
        if (prev[k] !== -1) continue;
        prev[k] = cur;
        queue.push(k);
      }
    }
    if (prev[goal] === -1) return null;
    const path: Point[] = [];
    for (let k = goal; k !== start; k = prev[k]!) path.push({ x: k % this.cols, y: Math.floor(k / this.cols) });
    return path.reverse();
  }

  /**
   * Plan a walk that ends by interacting with `obj`:
   * buildings path onto their door; solid props path to the closest adjacent walkable tile.
   */
  approach(obj: TownObject, from: Point): { path: Point[]; face: Dir } | null {
    if (obj.door) {
      const path = this.findPath(from, obj.door);
      if (!path) return null;
      const last = path.length >= 2 ? path[path.length - 2]! : from;
      return { path, face: path.length ? dirBetween(last, obj.door) : "up" };
    }
    let best: { path: Point[]; face: Dir } | null = null;
    for (let y = obj.y; y < obj.y + obj.h; y++) {
      for (let x = obj.x; x < obj.x + obj.w; x++) {
        for (const d of DIRS) {
          const ax = x - DELTA[d].x;
          const ay = y - DELTA[d].y;
          const path = this.findPath(from, { x: ax, y: ay });
          if (path && (!best || path.length < best.path.length)) best = { path, face: d };
        }
      }
    }
    return best;
  }

  /** Tile from which a visitor would naturally arrive at `obj` (used when teleporting via the Map menu). */
  arrivalTile(obj: TownObject, from: Point): { at: Point; face: Dir } {
    const plan = this.approach(obj, from);
    if (!plan) return { at: from, face: "down" };
    // Stop one tile short of a door so the visitor isn't standing in the doorway.
    const path = obj.door ? plan.path.slice(0, -1) : plan.path;
    return { at: path[path.length - 1] ?? from, face: plan.face };
  }
}
