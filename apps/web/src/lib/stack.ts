/**
 * Dan's tech stack as pixel logos, and where each tech was used. One logo per tech, in this order:
 * hand-drawn (stack-meta.ts), pixelated from simple-icons at build time (scripts/pixel-logos.ts),
 * or a lettered tile in the brand colour.
 */
import generated from "../generated/stack-logos.json";
import { profile } from "./profile";
import { NON_STACK_GROUPS, STACK_HEX, STACK_ROWS, canonicalTech, hashColour, luminance, monogram } from "./stack-meta";

export interface PixelLogo {
  /** Brand colour, #rrggbb. */
  hex: string;
  /** LOGO_GRID rows. Legend:  # brand colour · o white · . transparent */
  rows: readonly string[];
  /** Light brands sit on a dark tile and dark brands on a light one, so every logo shows up. */
  tile: string;
}

const PIXELATED = generated as Record<string, { hex: string; rows: string[] }>;
const LIGHT_TILE = "#f4efe2";
const DARK_TILE = "#1b1b2a";

export function logoFor(name: string): PixelLogo {
  const pixelated = PIXELATED[name] ?? PIXELATED[canonicalTech(name)];
  const hex = STACK_HEX[name] ?? pixelated?.hex ?? hashColour(name);
  const rows = STACK_ROWS[name] ?? pixelated?.rows ?? monogram(name);
  return { hex, rows, tile: luminance(hex) > 0.45 ? DARK_TILE : LIGHT_TILE };
}

/** Rects (one per lit cell, merged along rows) for drawing a logo as SVG or on a canvas. */
export function logoRuns(rows: readonly string[]): { x: number; y: number; w: number; white: boolean }[] {
  const runs: { x: number; y: number; w: number; white: boolean }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x]!;
      if (c === ".") {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === c) w++;
      runs.push({ x, y, w, white: c === "o" });
      x += w;
    }
  });
  return runs;
}

export interface TechUse {
  /** Canonical name, e.g. "Stripe" for "Stripe Connect" too. */
  name: string;
  /** Projects and roles that used it, newest first. */
  usedIn: { kind: "project" | "role"; id: string; title: string; date: string }[];
}

/** Every software tech in the profile with where it was used, most used first. */
export function techUsage(): TechUse[] {
  const uses = new Map<string, TechUse>();
  const add = (raw: string, entry?: TechUse["usedIn"][number]) => {
    const name = canonicalTech(raw);
    const use = uses.get(name) ?? { name, usedIn: [] };
    if (entry && !use.usedIn.some((u) => u.kind === entry.kind && u.id === entry.id)) use.usedIn.push(entry);
    uses.set(name, use);
  };
  for (const g of profile.skills) if (!NON_STACK_GROUPS.includes(g.group)) g.items.forEach((i) => add(i));
  for (const p of profile.projects) p.tags.forEach((t) => add(t, { kind: "project", id: p.id, title: p.title, date: p.start ?? p.date }));
  for (const e of profile.experience) e.skills?.forEach((s) => add(s, { kind: "role", id: e.id, title: `${e.role}, ${e.org}`, date: e.start }));
  for (const u of uses.values()) u.usedIn.sort((a, b) => b.date.localeCompare(a.date));
  return [...uses.values()].sort((a, b) => b.usedIn.length - a.usedIn.length || a.name.localeCompare(b.name));
}
