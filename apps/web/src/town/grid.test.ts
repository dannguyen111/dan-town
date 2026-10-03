import { describe, expect, it } from "vitest";
import { TownGrid } from "./grid.ts";
import { COLS, GROUND, OBJECTS, SPAWN } from "./map.ts";

describe("town map", () => {
  const grid = new TownGrid();

  it("has a rectangular ground layer", () => {
    for (const row of GROUND) expect(row).toHaveLength(COLS);
  });

  it("spawns on a walkable tile", () => {
    expect(grid.isWalkable(SPAWN.x, SPAWN.y)).toBe(true);
  });

  it("does not overlap objects", () => {
    const seen = new Set<string>();
    for (const o of OBJECTS)
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) {
          const k = `${x},${y}`;
          expect(seen.has(k), `${o.id} overlaps at ${k}`).toBe(false);
          seen.add(k);
        }
  });

  it.each(OBJECTS.map((o) => [o.id, o] as const))("%s is reachable from spawn", (_id, obj) => {
    const plan = grid.approach(obj, SPAWN);
    expect(plan).not.toBeNull();
    if (obj.door) expect(plan!.path.at(-1)).toEqual(obj.door);
  });

  it("finds shortest paths and respects collisions", () => {
    const path = grid.findPath(SPAWN, { x: 12, y: 7 });
    expect(path).toEqual([{ x: 12, y: 7 }]);
    expect(grid.findPath(SPAWN, { x: 11, y: 9 })).toBeNull(); // pond is solid
    for (const p of grid.findPath(SPAWN, { x: 3, y: 14 }) ?? []) expect(grid.isWalkable(p.x, p.y)).toBe(true);
  });

  it("treats doors as walkable triggers", () => {
    const home = OBJECTS.find((o) => o.id === "home")!;
    expect(grid.isWalkable(home.door!.x, home.door!.y)).toBe(true);
    expect(grid.doorAt(home.door!.x, home.door!.y)?.id).toBe("home");
    expect(grid.isWalkable(home.x, home.y)).toBe(false);
  });

  it("arrival tiles are walkable and next to their object", () => {
    for (const o of OBJECTS) {
      const { at } = grid.arrivalTile(o, SPAWN);
      expect(grid.isWalkable(at.x, at.y)).toBe(true);
      expect(grid.doorAt(at.x, at.y)).toBeUndefined();
    }
  });
});

describe("sprites", async () => {
  const { compose, SPRITE_W, SPRITE_H } = await import("./sprites.ts");
  it.each(["down", "up", "right"] as const)("%s frames are %dx%d bitmaps", (dir) => {
    for (const frame of [0, 1, 2] as const) {
      const rows = compose(dir, frame);
      expect(rows).toHaveLength(SPRITE_H);
      for (const r of rows) expect(r).toHaveLength(SPRITE_W);
    }
  });
});
