import { parse } from "yaml";
import { ProfileSchema, type Profile, type Visibility } from "./schema.ts";

export type Audience = "public" | "twin";

const ALLOWED: Record<Audience, ReadonlySet<Visibility>> = {
  public: new Set(["public"]),
  twin: new Set(["public", "twin"]),
};

export class ProfileError extends Error {}

/** Parse and validate YAML text. Throws a readable ProfileError listing every problem. */
export function loadProfile(yamlText: string): Profile {
  const result = ProfileSchema.safeParse(parse(yamlText));
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new ProfileError(`profile.yaml is invalid:\n${issues.join("\n")}`);
  }
  return result.data;
}

/** Recursively drop entries the audience may not see, then strip `visibility` markers. */
function filterTree(value: unknown, allowed: ReadonlySet<Visibility>): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((v) => !(isRecord(v) && typeof v.visibility === "string" && !allowed.has(v.visibility as Visibility)))
      .map((v) => filterTree(v, allowed));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "visibility") continue;
      out[k] = filterTree(v, allowed);
    }
    return out;
  }
  return value;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The audience-specific view of the profile. `private` and twin-only notes never reach the website. */
export function projectFor(profile: Profile, audience: Audience): Profile {
  const { private: _private, ...rest } = profile;
  const view = filterTree(rest, ALLOWED[audience]) as Profile;
  if (audience === "public") view.twin = { voice: "", notes: [] };
  return view;
}

const fmtRange = (start: string, end: string | null) => `${start} – ${end ?? "present"}`;

/** Markdown knowledge for the digital twin (public + twin entries). */
export function renderTwinContext(profile: Profile): string {
  const p = projectFor(profile, "twin");
  const lines: string[] = [];
  const h = (s: string) => lines.push("", `## ${s}`);

  lines.push(`# ${p.identity.name}: ${p.identity.headline}`, p.identity.tagline);
  if (p.identity.open_to) lines.push(`Open to: ${p.identity.open_to}`);

  h("About");
  lines.push(p.about.intro, ...p.about.paragraphs);

  h("Experience");
  for (const e of p.experience) {
    lines.push(`### ${e.role}, ${e.org} (${fmtRange(e.start, e.end)}${e.location ? `, ${e.location}` : ""})${e.research ? " [research]" : ""}`);
    lines.push(...e.highlights.map((x) => `- ${x}`));
    if (e.skills.length) lines.push(`Skills: ${e.skills.join(", ")}`);
  }

  h("Education");
  for (const e of p.education) {
    const meta = [e.gpa && `GPA ${e.gpa}`, e.rank && `rank ${e.rank}`].filter(Boolean).join(", ");
    lines.push(`### ${e.degree}, ${e.school} (${fmtRange(e.start, e.end)})${meta ? `: ${meta}` : ""}`);
    if (e.honors.length) lines.push(`Honors: ${e.honors.join(", ")}`);
  }

  h("Projects");
  for (const pr of p.projects) {
    lines.push(`### ${pr.title} (${pr.start ? fmtRange(pr.start, pr.end ?? null) : pr.date})${pr.research ? " [research]" : ""}`, pr.tagline);
    if (pr.tags.length) lines.push(`Tags: ${pr.tags.join(", ")}`);
    const links = Object.entries(pr.links).map(([k, v]) => `${k}: ${v}`);
    if (links.length) lines.push(`Links: ${links.join(" · ")}`);
    if (pr.body.trim()) lines.push(pr.body.trim());
  }

  if (p.research.statement || p.research.interests.length) {
    h("Research interests");
    if (p.research.statement) lines.push(p.research.statement);
    lines.push(...p.research.interests.map((i) => `- ${i.text}`));
  }

  h("Skills");
  for (const s of p.skills) lines.push(`- ${s.group}: ${s.items.join(", ")}`);

  h("Honors");
  for (const x of p.honors) lines.push(`- ${x.title}, ${x.org} (${x.date})${x.description ? `: ${x.description}` : ""}`);

  h("Interests");
  for (const i of p.interests) {
    lines.push(`- ${i.title}: ${i.blurb}`);
    lines.push(...i.details.map((d) => `  - ${d}`));
  }

  h("Links");
  for (const l of p.links) if (l.url) lines.push(`- ${l.label}: ${l.url}`);

  if (p.twin.notes.length) {
    h("Extra notes from Dan");
    lines.push(...p.twin.notes.map((n) => `- ${n.text}`));
  }
  return lines.join("\n").trim() + "\n";
}

/**
 * Full Markdown export for resume / application workflows (Drive).
 * Includes twin-only AND private entries, so it must stay private.
 */
export function renderFullMarkdown(profile: Profile): string {
  // Promote every entry to `public` so the twin renderer includes private items too.
  const allTwin = renderTwinContext(promoteAll(profile) as Profile);
  const priv = profile.private ? `\n## Private notes (never published)\n\n\`\`\`yaml\n${JSON.stringify(profile.private, null, 2)}\n\`\`\`\n` : "";
  return `<!-- Generated from profile.yaml. Edit the YAML, not this file. -->\n${allTwin}${priv}`;
}

function promoteAll(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(promoteAll);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = k === "visibility" ? "public" : promoteAll(v);
    return out;
  }
  return value;
}
