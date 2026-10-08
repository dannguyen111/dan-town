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

const framingLinks = (links: Record<string, string> = {}) =>
  Object.entries(links).map(([kind, href]) => ({ label: LINK_LABELS[kind] ?? `${kind} ↗`, href }));

/** Pixelated org logos in public/logos/orgs, matched on a role's org or a project's id. */
const ORG_LOGOS: [RegExp, string][] = [
  [/johnson & johnson/i, "jnj"],
  [/re:members/i, "remembers"],
  [/gettysburg college/i, "gettysburg"],
  [/kpmg/i, "kpmg"],
  [/^vendora$/i, "vendora"],
];
/** The pixel logo for a role's org (or a project's id), with alt text; undefined when there isn't one. */
export function orgLogo(orgOrProjectId: string): { src: string; alt: string } | undefined {
  const hit = ORG_LOGOS.find(([re]) => re.test(orgOrProjectId));
  if (!hit) return undefined;
  const name = (orgOrProjectId.split(",").at(-1) ?? orgOrProjectId).trim();
  return { src: `/logos/orgs/${hit[1]}.png`, alt: `${name.charAt(0).toUpperCase()}${name.slice(1)} logo` };
}

/** Roles and projects flagged `research: true`, newest first: the Research Lab's poster wall. */
export const researchEntries = () =>
  [
    ...profile.experience
      .filter((e) => e.research)
      .map((e) => ({
        id: `r-${e.id}`,
        kind: "role" as const,
        title: e.role,
        org: e.org,
        logo: orgLogo(e.org),
        sub: `${e.org}${e.location ? ` · ${e.location}` : ""} · ${formatRange(e.start, e.end)}`,
        start: e.start,
        question: e.research_framing?.question ?? e.highlights[0] ?? "",
        findings: e.research_framing ? e.research_framing.findings : e.highlights.slice(1),
        implications: e.research_framing?.implications,
        methods: e.research_framing ? e.research_framing.methods : e.skills,
        pipeline: e.research_framing?.pipeline ?? [],
        links: framingLinks(e.research_framing?.links),
      })),
    ...profile.projects
      .filter((p) => p.research)
      .map((p) => ({
        id: `p-${p.id}`,
        kind: "project" as const,
        title: p.title,
        org: "",
        logo: orgLogo(p.id),
        sub: projectWhen(p),
        start: p.start ?? p.date,
        question: p.research_framing?.question ?? p.tagline,
        findings: p.research_framing?.findings ?? ([] as string[]),
        implications: p.research_framing?.implications,
        methods: p.research_framing ? p.research_framing.methods : p.tags,
        pipeline: p.research_framing?.pipeline ?? [],
        links: [
          { label: "Full debrief →", href: `/projects/${p.id}` },
          ...(p.research_framing ? framingLinks(p.research_framing.links) : projectLinks(p).map((l) => ({ label: l.label, href: l.href }))),
        ],
      })),
  ].sort((a, b) => b.start.localeCompare(a.start));
