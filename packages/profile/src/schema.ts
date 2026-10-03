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

const Experience = z.object({
  id: z.string(),
  role: z.string(),
  org: z.string(),
  location: z.string().optional(),
  start: YearMonth,
  end: YearMonth.nullable(),
  highlights: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
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
  honors: z.array(z.string()).default([]),
  visibility: Visibility,
});

const Project = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "ids are used as URL slugs: lowercase, digits, dashes"),
  title: z.string(),
  tagline: z.string(),
  date: YearMonth,
  featured: z.boolean().default(false),
  image: z.string().optional(),
  tags: z.array(z.string()).default([]),
  links: z.record(z.string(), Url).prefault({}),
  body: z.string().default(""),
  visibility: Visibility,
});

const SkillGroup = z.object({
  group: z.string(),
  items: z.array(z.string()),
  visibility: Visibility,
});

const Honor = z.object({
  title: z.string(),
  date: YearMonth,
  org: z.string(),
  description: z.string().optional(),
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
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Project = z.infer<typeof Project>;
export type Experience = z.infer<typeof Experience>;
export type Interest = z.infer<typeof Interest>;
