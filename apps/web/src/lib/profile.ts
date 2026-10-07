import type { Profile } from "@dan-town/profile/schema";
import data from "../generated/profile.json";

/** The PUBLIC projection of the canonical profile (twin-only and private data are already stripped). */
export const profile = data as unknown as Profile;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonth(ym: string | null | undefined): string {
  if (!ym) return "Present";
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

export const formatRange = (start: string, end: string | null) => `${formatMonth(start)} – ${formatMonth(end)}`;

export const projectsByDate = () => [...profile.projects].sort((a, b) => b.date.localeCompare(a.date));

export const linkById = (id: string) => profile.links.find((l) => l.id === id && l.url);

type Project = Profile["projects"][number];

/** Short upper-case name for screens and card headers: the title up to its colon or dash, or the project id. */
export function codename(title: string, id: string): string {
  const head = title.split(/\s*[:—]\s*/)[0]!.trim();
  return (head.length <= 16 ? head : id.replace(/-/g, " ")).toUpperCase();
}

/** ACTIVE while a project has no end date (Present), COMPLETE otherwise. */
export const projectStatus = (p: Project) => (p.end === null ? "ACTIVE" : "COMPLETE");

/** "Jul 2026 – Present", or just the month for projects without a range. */
export const projectWhen = (p: Project) => (p.start ? formatRange(p.start, p.end ?? null) : formatMonth(p.date));

const LINK_LABELS: Record<string, string> = { demo: "Demo ↗", code: "Code ↗", paper: "Paper ↗", play: "Play ▶" };

/** A project's links with short console labels. */
export const projectLinks = (p: Project) =>
  Object.entries(p.links).map(([kind, href]) => ({ kind, label: LINK_LABELS[kind] ?? `${kind} ↗`, href, external: href.startsWith("http") }));
