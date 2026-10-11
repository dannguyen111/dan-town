import { describe, expect, it } from "vitest";
import { isBehind, type Front } from "./front.ts";
import { TILE, type TownObject } from "./map.ts";

// A fridge on tile (5, 6) whose art rises 10px above its tile.
const obj = { id: "f", kind: "prop", x: 5, y: 6, w: 1, h: 1, target: { type: "note", text: "" }, label: "F", style: "fridge" } as TownObject;
const front = { obj, x: 5 * TILE, y: 6 * TILE - 10, img: { width: TILE, height: TILE + 10 } } as Front;

describe("isBehind", () => {
  it("is true for a visitor on the tile just above the object", () => {
    expect(isBehind({ x: 5 * TILE, y: 5 * TILE }, front)).toBe(true);
  });

  it("is false in front of it, beside it, or too far behind for the art to reach", () => {
    expect(isBehind({ x: 5 * TILE, y: 7 * TILE }, front)).toBe(false);
    expect(isBehind({ x: 7 * TILE, y: 5 * TILE }, front)).toBe(false);
    expect(isBehind({ x: 5 * TILE, y: 3 * TILE }, front)).toBe(false);
  });
});
