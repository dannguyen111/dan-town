/**
 * Procedural pixel art for the static world. Everything is drawn ONCE into an offscreen
 * canvas at 1× resolution, so a frame is a single scaled drawImage plus two sprites.
 */
import { COLS, GROUND, OBJECTS, ROWS, TILE, type TownObject } from "./map.ts";

const INK = "#3b2a2a";

const C = {
  grass: "#9bd770",
  grassDark: "#86c75e",
  grassLight: "#b6e88b",
  path: "#f1d6a0",
  pathEdge: "#dfbd86",
  pebble: "#d2ad73",
  water: "#7cc8f2",
  waterLight: "#b3e2fa",
  stone: "#cdbca9",
  stoneDark: "#a8957f",
  canopy: "#4f9d4a",
  canopyLight: "#6dbb5b",
  canopyDark: "#3a7a3a",
  trunk: "#8a5a3b",
  wood: "#c98f5c",
  woodDark: "#9c6a3f",
  window: "#bfe6ff",
  windowShine: "#ffffff",
  flowers: ["#ff8fab", "#ffd166", "#ffffff", "#c49bff"],
} as const;

const BUILDING_THEMES: Record<string, { wall: string; roof: string; roofDark: string; trim: string }> = {
  home: { wall: "#fff1d6", roof: "#e76f51", roofDark: "#c0533a", trim: "#f4a261" },
  dev: { wall: "#e8f1ff", roof: "#4a7bd1", roofDark: "#355fa8", trim: "#9dc0ff" },
  lab: { wall: "#f2f7f5", roof: "#3f8f7a", roofDark: "#2d6b5b", trim: "#9fe0cc" },
  music: { wall: "#ffe3ef", roof: "#d1497a", roofDark: "#a8355f", trim: "#ffa8c8" },
  arcade: { wall: "#3a3160", roof: "#ff7a59", roofDark: "#d95a3c", trim: "#59f0d0" },
};

/** Deterministic noise so the town looks identical on every visit. */
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

function grassTile(ctx: Ctx, tx: number, ty: number, flowers: boolean) {
  const px = tx * TILE;
  const py = ty * TILE;
  rect(ctx, C.grass, px, py, TILE, TILE);
  for (let i = 0; i < 5; i++) {
    const gx = px + Math.floor(rand(tx, ty, i) * 15);
    const gy = py + Math.floor(rand(tx, ty, i + 9) * 14);
    rect(ctx, rand(tx, ty, i + 3) > 0.5 ? C.grassDark : C.grassLight, gx, gy, 1, 2);
  }
  if (flowers) {
    for (let i = 0; i < 3; i++) {
      const fx = px + 2 + Math.floor(rand(tx, ty, i + 20) * 11);
      const fy = py + 2 + Math.floor(rand(tx, ty, i + 30) * 11);
      const col = C.flowers[Math.floor(rand(tx, ty, i + 40) * C.flowers.length)]!;
      rect(ctx, col, fx - 1, fy, 3, 1);
      rect(ctx, col, fx, fy - 1, 1, 3);
      rect(ctx, "#ffe066", fx, fy, 1, 1);
    }
  }
}

function pathTile(ctx: Ctx, tx: number, ty: number) {
  const px = tx * TILE;
  const py = ty * TILE;
  rect(ctx, C.path, px, py, TILE, TILE);
  const isPath = (x: number, y: number) => GROUND[y]?.[x] === "=" || OBJECTS.some((o) => o.door?.x === x && o.door?.y === y);
  // Soft edges where the path meets grass.
  if (!isPath(tx, ty - 1)) rect(ctx, C.pathEdge, px, py, TILE, 1);
  if (!isPath(tx, ty + 1)) rect(ctx, C.pathEdge, px, py + TILE - 1, TILE, 1);
  if (!isPath(tx - 1, ty)) rect(ctx, C.pathEdge, px, py, 1, TILE);
  if (!isPath(tx + 1, ty)) rect(ctx, C.pathEdge, px + TILE - 1, py, 1, TILE);
  for (let i = 0; i < 3; i++) {
    rect(ctx, C.pebble, px + 2 + Math.floor(rand(tx, ty, i + 50) * 12), py + 2 + Math.floor(rand(tx, ty, i + 60) * 12), 2, 1);
  }
}

function waterTile(ctx: Ctx, tx: number, ty: number) {
  const px = tx * TILE;
  const py = ty * TILE;
  rect(ctx, C.water, px, py, TILE, TILE);
  const isWater = (x: number, y: number) => GROUND[y]?.[x] === "~";
  if (!isWater(tx, ty - 1)) rect(ctx, C.stone, px, py, TILE, 3);
  if (!isWater(tx, ty + 1)) rect(ctx, C.stoneDark, px, py + TILE - 3, TILE, 3);
  if (!isWater(tx - 1, ty)) rect(ctx, C.stone, px, py, 3, TILE);
  if (!isWater(tx + 1, ty)) rect(ctx, C.stoneDark, px + TILE - 3, py, 3, TILE);
  rect(ctx, C.waterLight, px + 4 + Math.floor(rand(tx, ty, 70) * 6), py + 6, 4, 1);
  rect(ctx, C.waterLight, px + 6 + Math.floor(rand(tx, ty, 71) * 4), py + 10, 3, 1);
}

function treeTile(ctx: Ctx, tx: number, ty: number) {
  grassTile(ctx, tx, ty, false);
  const px = tx * TILE;
  const py = ty * TILE;
  rect(ctx, C.trunk, px + 6, py + 11, 4, 4);
  rect(ctx, C.canopyDark, px + 1, py + 3, 14, 9);
  rect(ctx, C.canopyDark, px + 3, py + 1, 10, 12);
  rect(ctx, C.canopy, px + 2, py + 3, 12, 7);
  rect(ctx, C.canopy, px + 4, py + 2, 8, 9);
  rect(ctx, C.canopyLight, px + 4, py + 3, 4, 2);
  rect(ctx, C.canopyLight, px + 3, py + 5, 2, 2);
}

function building(ctx: Ctx, o: TownObject) {
  const t = BUILDING_THEMES[o.style]!;
  const px = o.x * TILE;
  const py = o.y * TILE;
  const W = o.w * TILE;
  const H = o.h * TILE;
  const roofH = Math.round(H * 0.45);

  // Ground shadow
  rect(ctx, "rgba(40,60,20,0.18)", px + 2, py + H - 2, W, 3);

  // Walls
  rect(ctx, INK, px + 1, py + roofH - 2, W - 2, H - roofH + 2);
  rect(ctx, t.wall, px + 2, py + roofH - 1, W - 4, H - roofH);
  rect(ctx, t.trim, px + 2, py + H - 3, W - 4, 2);

  // Roof with rounded corners and shingles
  rect(ctx, INK, px, py + 1, W, roofH);
  rect(ctx, INK, px + 1, py, W - 2, roofH + 1);
  rect(ctx, t.roof, px + 1, py + 1, W - 2, roofH - 1);
  for (let y = py + 4; y < py + roofH - 1; y += 3) rect(ctx, t.roofDark, px + 1, y, W - 2, 1);
  rect(ctx, "rgba(255,255,255,0.35)", px + 2, py + 1, W - 4, 1);

  // Windows on every column except the door's
  const wallTop = py + roofH + 1;
  for (let cx = o.x; cx < o.x + o.w; cx++) {
    if (o.door && cx === o.door.x) continue;
    const wx = cx * TILE + 4;
    const wy = wallTop + Math.max(1, Math.floor((H - roofH - 14) / 2));
    rect(ctx, INK, wx - 1, wy - 1, 10, 8);
    rect(ctx, o.style === "arcade" ? "#ffd166" : C.window, wx, wy, 8, 6);
    rect(ctx, C.windowShine, wx + 1, wy + 1, 2, 2);
    rect(ctx, INK, wx + 4, wy, 1, 6);
  }

  // Door
  if (o.door) {
    const dx = o.door.x * TILE + 4;
    const dh = Math.min(12, H - roofH - 2);
    rect(ctx, INK, dx - 1, py + H - dh - 1, 10, dh + 1);
    rect(ctx, o.style === "arcade" ? "#59f0d0" : C.trunk, dx, py + H - dh, 8, dh);
    rect(ctx, "#ffd166", dx + 6, py + H - dh / 2, 1, 1);
    rect(ctx, C.path, dx - 1, py + H, 10, 1);
  }

  // Personality per building
  if (o.style === "home") {
    rect(ctx, INK, px + W - 13, py - 5, 7, 8);
    rect(ctx, "#b5654a", px + W - 12, py - 4, 5, 7);
  } else if (o.style === "dev") {
    rect(ctx, INK, px + W / 2, py - 7, 1, 7);
    rect(ctx, "#ff7a59", px + W / 2 - 1, py - 9, 3, 3);
    // "</>" in pixels on the roof
    const sx = px + W / 2 - 8;
    const sy = py + 4;
    const glyph = ["..#.......#..", ".#....#....#.", "#....#......#", ".#..#......#.", "..#.#.....#.."];
    glyph.forEach((row, y) => [...row].forEach((c, x) => c === "#" && rect(ctx, "#ffffff", sx + x, sy + y, 1, 1)));
  } else if (o.style === "lab") {
    // A satellite dish and a vent on the roof, and a flask bubbling green on the roof sign.
    rect(ctx, INK, px + 6, py - 6, 1, 6);
    rect(ctx, "#d7e3ea", px + 3, py - 9, 8, 2);
    rect(ctx, "#d7e3ea", px + 4, py - 7, 6, 1);
    rect(ctx, "#ff7a59", px + 6, py - 11, 1, 2);
    rect(ctx, INK, px + W - 11, py - 5, 7, 5);
    rect(ctx, "#b8c4cc", px + W - 10, py - 4, 5, 4);
    for (let i = 0; i < 3; i++) rect(ctx, "#7c8a93", px + W - 10, py - 3 + i, 5, 1 - (i % 2));
    const flask = ["..oo..", "..oo..", ".o..o.", "o.gg.o", "oggggo", ".oooo."];
    const fx = px + W / 2 - 3;
    flask.forEach((row, y) => [...row].forEach((c, x) => c !== "." && rect(ctx, c === "g" ? "#7dffb0" : "#ffffff", fx + x, py + 3 + y, 1, 1)));
  } else if (o.style === "music") {
    const note = ["..##", "..#.", "..#.", "###.", "##.."];
    note.forEach((row, y) => [...row].forEach((c, x) => c === "#" && rect(ctx, "#ffffff", px + W / 2 - 2 + x, py + 3 + y, 1, 1)));
  } else if (o.style === "arcade") {
    for (let x = px + 2; x < px + W - 2; x += 4) rect(ctx, (x / 4) % 2 ? "#59f0d0" : "#ffd166", x, py + roofH - 1, 2, 1);
    const star = [".#.", "###", ".#."];
    star.forEach((row, y) => [...row].forEach((c, x) => c === "#" && rect(ctx, "#ffffff", px + W / 2 - 1 + x, py + 3 + y, 1, 1)));
  }
}

function garden(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  const W = o.w * TILE;
  const H = o.h * TILE;
  rect(ctx, "#a7d97d", px, py, W, H);
  for (let ty = o.y; ty < o.y + o.h; ty++)
    for (let tx = o.x; tx < o.x + o.w; tx++) {
      if (o.door && tx === o.door.x && ty === o.door.y) continue;
      // Flower beds in rows
      const bx = tx * TILE;
      const by = ty * TILE;
      rect(ctx, "#b5835a", bx + 2, by + 4, 12, 8);
      for (let i = 0; i < 4; i++) {
        const col = C.flowers[(tx + ty + i) % C.flowers.length]!;
        const fx = bx + 4 + (i % 2) * 6;
        const fy = by + 5 + Math.floor(i / 2) * 4;
        rect(ctx, "#4f9d4a", fx, fy + 1, 1, 2);
        rect(ctx, col, fx - 1, fy, 3, 2);
      }
    }
  // Fence with a gate gap
  const fence = (x: number, y: number, w: number, h: number) => rect(ctx, C.woodDark, x, y, w, h);
  fence(px, py, W, 2);
  fence(px, py + H - 2, W, 2);
  fence(px, py, 2, H);
  fence(px + W - 2, py, 2, H);
  for (let x = px; x < px + W; x += 4) rect(ctx, C.wood, x, py - 1, 2, 4);
  if (o.door) rect(ctx, C.path, o.door.x * TILE + 2, o.door.y * TILE - 1, 12, TILE - 2);
  // Sunflower mascot
  rect(ctx, "#4f9d4a", px + W - 8, py + 6, 1, 8);
  rect(ctx, "#ffd166", px + W - 11, py + 3, 7, 6);
  rect(ctx, "#8a5a3b", px + W - 9, py + 5, 3, 2);
}

function stall(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  const W = o.w * TILE;
  const H = o.h * TILE;
  rect(ctx, "rgba(40,60,20,0.18)", px + 2, py + H - 1, W, 3);
  // Shopfront
  rect(ctx, INK, px + 2, py + 12, W - 4, H - 12);
  rect(ctx, C.wood, px + 3, py + 13, W - 6, H - 14);
  rect(ctx, C.woodDark, px + 3, py + 13, W - 6, 2);
  // Display windows with clothes, one per column except the door's
  const goods = ["#ff8fab", "#ffd166", "#7cc8f2", "#c49bff", "#ff7a59", "#9bd770"];
  for (let cx = o.x, i = 0; cx < o.x + o.w; cx++) {
    if (o.door && cx === o.door.x) continue;
    const wx = cx * TILE + 2;
    rect(ctx, INK, wx - 1, py + 16, 14, 11);
    rect(ctx, C.window, wx, py + 17, 12, 9);
    rect(ctx, goods[i++ % goods.length]!, wx + 1, py + 19, 5, 6);
    rect(ctx, goods[i++ % goods.length]!, wx + 6, py + 19, 5, 6);
  }
  // Door
  if (o.door) {
    const dx = o.door.x * TILE + 4;
    rect(ctx, INK, dx - 1, py + H - 13, 10, 13);
    rect(ctx, "#ff2300", dx, py + H - 12, 8, 12);
    rect(ctx, "#ffd166", dx + 6, py + H - 6, 1, 1);
    rect(ctx, C.path, dx - 1, py + H, 10, 1);
  }
  // Striped awning (Depop red)
  rect(ctx, INK, px, py, W, 12);
  for (let x = 0; x < W - 2; x += 6) rect(ctx, (x / 6) % 2 ? "#ffffff" : "#ff2300", px + 1 + x, py + 1, 6, 10);
  for (let x = px + 1; x < px + W - 1; x += 6) rect(ctx, INK, x + 2, py + 11, 2, 1);
}

function board(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  const W = o.w * TILE;
  rect(ctx, C.woodDark, px + 4, py + 10, 2, 6);
  rect(ctx, C.woodDark, px + W - 6, py + 10, 2, 6);
  rect(ctx, INK, px + 1, py, W - 2, 12);
  rect(ctx, C.wood, px + 2, py + 1, W - 4, 10);
  rect(ctx, "#0a66c2", px + 5, py + 3, 9, 6);
  rect(ctx, "#ffffff", px + 7, py + 4, 1, 4);
  rect(ctx, "#ffffff", px + 9, py + 5, 1, 3);
  rect(ctx, "#ffffff", px + 10, py + 5, 2, 1);
  rect(ctx, "#ffffff", px + 11, py + 6, 1, 2);
  rect(ctx, "#fff8e1", px + 17, py + 3, 9, 6);
  rect(ctx, "#ff7a59", px + 18, py + 4, 7, 1);
  rect(ctx, "#c9b8a6", px + 18, py + 6, 6, 1);
}

function signpost(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, C.woodDark, px + 7, py + 6, 2, 10);
  rect(ctx, INK, px + 1, py + 1, 14, 8);
  rect(ctx, "#24292f", px + 2, py + 2, 12, 6);
  // Tiny octocat-ish face
  rect(ctx, "#ffffff", px + 6, py + 3, 4, 4);
  rect(ctx, "#ffffff", px + 5, py + 3, 1, 1);
  rect(ctx, "#ffffff", px + 10, py + 3, 1, 1);
  rect(ctx, "#24292f", px + 7, py + 5, 1, 1);
  rect(ctx, "#24292f", px + 8, py + 5, 1, 1);
}

function mailbox(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  rect(ctx, C.woodDark, px + 7, py + 9, 2, 7);
  rect(ctx, INK, px + 2, py + 2, 12, 8);
  rect(ctx, "#e63946", px + 3, py + 3, 10, 6);
  rect(ctx, "#ff8a8a", px + 4, py + 3, 8, 1);
  rect(ctx, "#ffd166", px + 12, py, 1, 5);
  rect(ctx, "#ffd166", px + 12, py, 3, 2);
}

function statue(ctx: Ctx, o: TownObject) {
  const px = o.x * TILE;
  const py = o.y * TILE;
  const bronze = "#b07a3c";
  const bronzeDark = "#7d5326";
  const bronzeLight = "#d9a35f";
  rect(ctx, "rgba(40,60,20,0.18)", px + 2, py + 30, 14, 2);
  // Stone pedestal with a gold plaque
  rect(ctx, INK, px + 1, py + 21, 14, 11);
  rect(ctx, C.stone, px + 2, py + 22, 12, 9);
  rect(ctx, C.stoneDark, px + 2, py + 29, 12, 2);
  rect(ctx, "#ffd166", px + 5, py + 24, 6, 3);
  rect(ctx, "#c9a227", px + 6, py + 25, 4, 1);
  // Bronze player mid-leap for a tomahawk: ball cocked behind the head, knee driving up
  rect(ctx, bronzeDark, px + 7, py + 16, 2, 5); // trailing leg
  rect(ctx, bronzeDark, px + 6, py + 20, 3, 1);
  rect(ctx, bronze, px + 10, py + 15, 3, 2); // raised knee
  rect(ctx, bronzeDark, px + 12, py + 16, 2, 3);
  rect(ctx, bronze, px + 7, py + 13, 5, 3); // shorts
  rect(ctx, bronze, px + 7, py + 8, 5, 6); // torso
  rect(ctx, bronzeLight, px + 9, py + 9, 2, 3);
  rect(ctx, bronze, px + 12, py + 9, 2, 1); // free arm reaching for the rim
  rect(ctx, bronze, px + 13, py + 10, 1, 4);
  rect(ctx, bronze, px + 6, py + 4, 1, 6); // throwing arm, cocked back
  rect(ctx, bronze, px + 5, py + 3, 2, 2);
  rect(ctx, bronze, px + 7, py + 4, 4, 4); // head
  rect(ctx, bronzeDark, px + 7, py + 5, 4, 1);
  rect(ctx, bronzeLight, px + 10, py + 6, 1, 1);
  // The ball, palmed behind the head
  rect(ctx, "#e8742a", px + 1, py + 1, 5, 4);
  rect(ctx, "#a34d16", px + 3, py + 1, 1, 4);
  rect(ctx, "#a34d16", px + 1, py + 2, 5, 1);
}

/** Bake the whole static town into one canvas. */
export function bakeWorld(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext("2d")!;

  GROUND.forEach((row, ty) => {
    for (let tx = 0; tx < COLS; tx++) {
      const t = row[tx];
      if (t === "T") treeTile(ctx, tx, ty);
      else if (t === "=") pathTile(ctx, tx, ty);
      else if (t === "~") waterTile(ctx, tx, ty);
      else grassTile(ctx, tx, ty, t === ",");
    }
  });
  // Doors sit on path-coloured ground.
  for (const o of OBJECTS) if (o.door) pathTile(ctx, o.door.x, o.door.y);

  for (const o of OBJECTS) {
    if (o.kind === "building") building(ctx, o);
    else if (o.kind === "garden") garden(ctx, o);
    else if (o.kind === "stall") stall(ctx, o);
    else if (o.kind === "board") board(ctx, o);
    else if (o.kind === "signpost") signpost(ctx, o);
    else if (o.kind === "mailbox") mailbox(ctx, o);
    else if (o.kind === "statue") statue(ctx, o);
  }
  return canvas;
}
