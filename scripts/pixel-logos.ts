/**
 * Pixelates the real logo of every tech in the profile (skills, project tags, experience skills)
 * from simple-icons, for the retro stack chips and the Dev Center's stack radar.
 * Runs in prebuild, after profile:build:  npm run logos:build
 *
 * Each SVG is rendered big with sharp, then cut into a LOGO_GRID square of cells; a cell is on when
 * enough of it is covered. Techs simple-icons doesn't carry are left out here and get a hand-drawn
 * logo or a lettered tile on the site (apps/web/src/lib/stack-meta.ts).
 *
 * Writes apps/web/src/generated/stack-logos.json:  { [tech]: { hex, rows } }
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import * as icons from "simple-icons";
import { LOGO_GRID, NON_STACK_GROUPS, STACK_ALIASES, STACK_ROWS } from "../apps/web/src/lib/stack-meta.ts";

/** Pixels rendered per logo cell before averaging. */
const SUPER = 8;
/** Share of a cell that must be covered for it to light up. */
export const COVERAGE = 0.42;

interface Icon {
  slug: string;
  title: string;
  hex: string;
  path: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function techsIn(profile: {
  skills: { group: string; items: string[] }[];
  projects: { tags: string[] }[];
  experience: { skills?: string[] }[];
}): string[] {
  const names = new Set<string>();
  for (const g of profile.skills) if (!NON_STACK_GROUPS.includes(g.group)) g.items.forEach((i) => names.add(i));
  for (const p of profile.projects) p.tags.forEach((t) => names.add(t));
  for (const e of profile.experience) e.skills?.forEach((s) => names.add(s));
  return [...names].sort();
}

/** The simple-icons icon for a tech: its alias, or an icon whose slug or title is the same name. */
export function iconFor(name: string, all: readonly Icon[]): Icon | null {
  if (name in STACK_ALIASES) {
    const slug = STACK_ALIASES[name];
    return slug ? (all.find((i) => i.slug === slug) ?? null) : null;
  }
  const n = norm(name);
  return all.find((i) => i.slug === n || norm(i.title) === n) ?? null;
}

/** Which cells of a size×size grid are on, from an RGBA buffer of (size·SUPER)² pixels. */
export function cellsFrom(rgba: Uint8Array, size: number, coverage = COVERAGE): string[] {
  const w = size * SUPER;
  const rows: string[] = [];
  for (let cy = 0; cy < size; cy++) {
    let row = "";
    for (let cx = 0; cx < size; cx++) {
      let sum = 0;
      for (let y = 0; y < SUPER; y++) for (let x = 0; x < SUPER; x++) sum += rgba[((cy * SUPER + y) * w + cx * SUPER + x) * 4 + 3]!;
      row += sum / (SUPER * SUPER * 255) >= coverage ? "#" : ".";
    }
    rows.push(row);
  }
  return rows;
}

/** Share of lit cells below which a logo counts as thin line art and is redone with a lower bar. */
const SPARSE = 0.22;
const THIN_COVERAGE = 0.18;

/** Like cellsFrom, but line-art logos (outlines that vanish at the normal bar) keep their strokes. */
export function adaptiveCells(rgba: Uint8Array, size: number): string[] {
  const rows = cellsFrom(rgba, size);
  const lit = rows.join("").split("#").length - 1;
  return lit / (size * size) < SPARSE ? cellsFrom(rgba, size, THIN_COVERAGE) : rows;
}

async function pixelate(icon: Icon): Promise<string[]> {
  const px = LOGO_GRID * SUPER;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}"><path d="${icon.path}" fill="#000"/></svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return adaptiveCells(new Uint8Array(data), LOGO_GRID);
}

async function main() {
  const root = new URL("../apps/web/src/generated/", import.meta.url);
  const profile = JSON.parse(readFileSync(new URL("profile.json", root), "utf8"));
  const all = Object.values(icons).filter((i): i is Icon => typeof i === "object" && i !== null && "slug" in i);
  const out: Record<string, { hex: string; rows: string[] }> = {};
  const lettered: string[] = [];
  for (const name of techsIn(profile)) {
    const icon = STACK_ROWS[name] ? null : iconFor(name, all);
    if (!icon) {
      lettered.push(name);
      continue;
    }
    out[name] = { hex: `#${icon.hex}`, rows: await pixelate(icon) };
  }
  writeFileSync(new URL("stack-logos.json", root), JSON.stringify(out, null, 0) + "\n");
  console.log(`[logos] ${Object.keys(out).length} pixelated, ${lettered.length} hand-drawn or lettered: ${lettered.join(", ")}`);
}

// Tests import the helpers above without generating anything.
if (!process.env.VITEST) await main();
