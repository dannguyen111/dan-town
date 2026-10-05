import { describe, expect, it } from "vitest";
import { ARCADE_GROUND, ARCADE_OBJECTS, ARCADE_SPAWN } from "./arcade.ts";
import { TownGrid } from "./grid.ts";
import { HOME_GROUND, HOME_OBJECTS, HOME_SPAWN, easternTime, formatEastern } from "./home.ts";
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
    expect(grid.findPath(SPAWN, { x: 8, y: 14 })).toBeNull(); // pond is solid
    for (const p of grid.findPath(SPAWN, { x: 16, y: 20 }) ?? []) expect(grid.isWalkable(p.x, p.y)).toBe(true);
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

describe("arcade interior", () => {
  const grid = new TownGrid(ARCADE_OBJECTS, ARCADE_GROUND);

  it("has a rectangular ground layer", () => {
    for (const row of ARCADE_GROUND) expect(row).toHaveLength(ARCADE_GROUND[0].length);
  });

  it("spawns just inside the exit", () => {
    expect(grid.isWalkable(ARCADE_SPAWN.x, ARCADE_SPAWN.y)).toBe(true);
    const exit = grid.doorAt(ARCADE_SPAWN.x, ARCADE_SPAWN.y + 1);
    expect(exit?.target).toEqual({ type: "place", id: "town" });
  });

  it.each(ARCADE_OBJECTS.map((o) => [o.id, o] as const))("%s is reachable from the entrance", (_id, obj) => {
    expect(grid.approach(obj, ARCADE_SPAWN)).not.toBeNull();
  });

  it("walls are solid", () => {
    expect(grid.isWalkable(0, 5)).toBe(false);
    expect(grid.isWalkable(5, 1)).toBe(false);
    expect(grid.isWalkable(3, 13)).toBe(false);
  });

  it("the town has a matching door to walk back out of", () => {
    const town = new TownGrid();
    const arcade = OBJECTS.find((o) => o.target.type === "place" && o.target.id === "arcade")!;
    const { at } = town.arrivalTile(arcade, SPAWN);
    expect(town.isWalkable(at.x, at.y)).toBe(true);
  });
});

describe("home interior", () => {
  const grid = new TownGrid(HOME_OBJECTS, HOME_GROUND);

  it("has a rectangular ground layer", () => {
    for (const row of HOME_GROUND) expect(row).toHaveLength(HOME_GROUND[0].length);
  });

  it("spawns just inside the exit", () => {
    expect(grid.isWalkable(HOME_SPAWN.x, HOME_SPAWN.y)).toBe(true);
    expect(grid.doorAt(HOME_SPAWN.x, HOME_SPAWN.y + 1)?.target).toEqual({ type: "place", id: "town" });
  });

  it("does not overlap objects", () => {
    const seen = new Set<string>();
    for (const o of HOME_OBJECTS)
      for (let y = o.y; y < o.y + o.h; y++)
        for (let x = o.x; x < o.x + o.w; x++) {
          const k = `${x},${y}`;
          expect(seen.has(k), `${o.id} overlaps at ${k}`).toBe(false);
          seen.add(k);
        }
  });

  it.each(HOME_OBJECTS.map((o) => [o.id, o] as const))("%s is reachable from the entrance", (_id, obj) => {
    expect(grid.approach(obj, HOME_SPAWN)).not.toBeNull();
  });

  it("you can stand in front of the TV and face it", () => {
    const tv = HOME_OBJECTS.find((o) => o.id === "tv")!;
    expect(tv.hint).toBeTruthy();
    expect(grid.isWalkable(tv.x + 1, tv.y + 1)).toBe(true);
    expect(grid.objectAt(tv.x + 1, tv.y)?.id).toBe("tv");
  });

  it("the doorway between the rooms is open", () => {
    expect(grid.isWalkable(7, 9)).toBe(true);
    expect(grid.isWalkable(6, 9)).toBe(false);
  });
});

describe("eastern time", () => {
  it("reads the clock in New York, not the visitor's zone", () => {
    expect(easternTime(new Date("2026-07-01T16:05:00Z"))).toEqual({ h: 12, m: 5 }); // EDT
    expect(easternTime(new Date("2026-01-15T03:30:00Z"))).toEqual({ h: 22, m: 30 }); // EST
    expect(formatEastern(new Date("2026-01-15T05:07:00Z"))).toBe("12:07 AM");
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
