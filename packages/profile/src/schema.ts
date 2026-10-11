import { z } from "zod";

/** Where an entry may appear. Defaults to `public`. */
export const Visibility = z.enum(["public", "twin", "private"]).default("public");
export type Visibility = z.infer<typeof Visibility>;

const YearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "use YYYY-MM");
const Url = z.string().refine((u) => /^(https?:\/\/|mailto:|\/)/.test(u), "must be http(s)://, mailto:, or a /site path");

const Link = z.object({
  id: z.string(),
  label: z.string(),
  url: Url.nullable(),
  visibility: Visibility,
});

/** How a research item reads in the Research Lab; the professional text elsewhere is untouched. */
const ResearchFraming = z.object({
  question: z.string(),
  methods: z.array(z.string()).default([]),
  findings: z.array(z.string()).default([]),
  /** What it implies or what comes next. Only if the profile supports it. */
  implications: z.string().optional(),
  links: z.record(z.string(), Url).prefault({}),
  /** How the research runs, stage by stage: drawn as a flow chart on the poster. `loop` labels a return arrow. */
  pipeline: z.array(z.object({ label: z.string(), detail: z.string(), loop: z.string().optional() })).default([]),
});

const Experience = z.object({
  id: z.string(),
  role: z.string(),
  org: z.string(),
  location: z.string().optional(),
  start: YearMonth,
  end: YearMonth.nullable(),
  highlights: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  /** Research experience: also shown in the Research Lab. */
  research: z.boolean().default(false),
  research_framing: ResearchFraming.optional(),
  visibility: Visibility,
});

const Education = z.object({
  id: z.string(),
  school: z.string(),
  degree: z.string(),
  start: YearMonth,
  end: YearMonth.nullable(),
  gpa: z.string().optional(),
  rank: z.string().optional(),
  visibility: Visibility,
});

const Project = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "ids are used as URL slugs: lowercase, digits, dashes"),
  title: z.string(),
  tagline: z.string(),
  date: YearMonth,
  /** Optional range for resumes; `date` still drives site sorting. `end: null` means Present. */
  start: YearMonth.optional(),
  end: YearMonth.nullable().optional(),
  featured: z.boolean().default(false),
  image: z.string().optional(),
  tags: z.array(z.string()).default([]),
  links: z.record(z.string(), Url).prefault({}),
  body: z.string().default(""),
  /** A research project: also shown in the Research Lab. */
  research: z.boolean().default(false),
  research_framing: ResearchFraming.optional(),
  visibility: Visibility,
});

const SkillGroup = z.object({
  group: z.string(),
  items: z.array(z.string()),
  visibility: Visibility,
});

/** Every honor lives here, school ones included. `for` ties it to the experience, education or project it came from. */
const Honor = z.object({
  title: z.string(),
  /** Optional when unknown; it then takes the date of the entry it is `for`. */
  date: YearMonth.optional(),
  org: z.string(),
  description: z.string().optional(),
  /** The id of an experience, education or project entry. */
  for: z.string().optional(),
  visibility: Visibility,
});

const Interest = z.object({
  id: z.string(),
  title: z.string(),
  emoji: z.string().optional(),
  blurb: z.string(),
  details: z.array(z.string()).default([]),
  images: z.array(z.object({ src: z.string(), alt: z.string() })).default([]),
  links: z.array(z.object({ label: z.string(), url: Url })).default([]),
  visibility: Visibility,
});

/** The Research Lab's whiteboard: what Dan wants to study next. */
const Research = z.object({
  statement: z.string().default(""),
  interests: z.array(z.object({ text: z.string(), visibility: Visibility })).default([]),
});

const TwinNote = z.object({ text: z.string(), visibility: Visibility });

export const ProfileSchema = z.object({
  version: z.literal(1),
  identity: z.object({
    name: z.string(),
    short_name: z.string(),
    headline: z.string(),
    tagline: z.string(),
    photo: z.string().optional(),
    email: z.email().optional(),
    open_to: z.string().optional(),
  }),
  about: z.object({
    intro: z.string(),
    paragraphs: z.array(z.string()).default([]),
  }),
  links: z.array(Link).default([]),
  experience: z.array(Experience).default([]),
  education: z.array(Education).default([]),
  projects: z.array(Project).default([]),
  skills: z.array(SkillGroup).default([]),
  honors: z.array(Honor).default([]),
  interests: z.array(Interest).default([]),
  research: Research.prefault({}),
  twin: z
    .object({
      voice: z.string().default("Friendly and concise, first person."),
      notes: z.array(TwinNote).default([]),
    })
    .prefault({}),
  integrations: z
    .object({
      github: z.object({ username: z.string().nullable() }).default({ username: null }),
      leetcode: z.object({ username: z.string().nullable() }).default({ username: null }),
      spotify: z.object({ enabled: z.boolean() }).default({ enabled: false }),
    })
    .prefault({}),
  /** Never exported. Resume workflows only. */
  private: z.record(z.string(), z.unknown()).optional(),
}).superRefine((p, ctx) => {
  const ids = new Set([...p.experience, ...p.education, ...p.projects].map((e) => e.id));
  p.honors.forEach((h, i) => {
    if (h.for && !ids.has(h.for)) ctx.addIssue({ code: "custom", path: ["honors", i, "for"], message: `no experience, education or project with id "${h.for}"` });
    if (!h.date && !h.for) ctx.addIssue({ code: "custom", path: ["honors", i, "date"], message: "needs a date, or a `for` to take one from" });
  });
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Project = z.infer<typeof Project>;
export type Experience = z.infer<typeof Experience>;
export type Interest = z.infer<typeof Interest>;
export type Honor = z.infer<typeof Honor>;

/**
 * An honor with its `for` resolved: what it is associated with (org, school or project title) and its date,
 * falling back to that entry's end date. `for` may point at an entry the audience can't see; it is then ignored.
 */
export function resolveHonor(p: Profile, h: Honor): Honor & { date: string; with?: string } {
  const exp = p.experience.find((e) => e.id === h.for);
  const edu = p.education.find((e) => e.id === h.for);
  const proj = p.projects.find((e) => e.id === h.for);
  const withLabel = exp?.org ?? edu?.school ?? proj?.title;
  const fallback = (exp ?? edu)?.end ?? (exp ?? edu)?.start ?? proj?.end ?? proj?.date;
  return { ...h, date: h.date ?? fallback ?? "", ...(withLabel ? { with: withLabel } : {}) };
}

/** Every honor, resolved, newest first. */
export const honorsByDate = (p: Profile) => p.honors.map((h) => resolveHonor(p, h)).sort((a, b) => b.date.localeCompare(a.date));
