/**
 * Dan's tech stack as pixel logos, and where each tech was used. One logo per tech, in this order:
 * hand-drawn (stack-meta.ts), pixelated from simple-icons at build time (scripts/pixel-logos.ts),
 * or a lettered tile in the brand colour.
 */
import generated from "../generated/stack-logos.json";
import { profile } from "./profile";
import { NON_STACK_GROUPS, canonicalTech, logoRuns, pickLogo, type PixelLogo } from "./stack-meta";

const PIXELATED = generated as Record<string, { hex: string; rows: string[] }>;

export type { PixelLogo };
export { logoRuns };

export const logoFor = (name: string): PixelLogo => pickLogo(name, PIXELATED);

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
