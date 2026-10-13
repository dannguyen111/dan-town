/**
 * The README's notice-board cards, each rendered once per theme. Every card reads only the PUBLIC
 * projection of the profile.
 */
import type { Profile } from "@dan-town/profile/schema";
import { NON_STACK_GROUPS, type PixelLogo } from "../../../apps/web/src/lib/stack-meta.ts";
import {
  card,
  CARD_HEAD,
  CARD_PAD,
  chip,
  chipFlow,
  chipWidth,
  clip,
  doc,
  esc,
  lines,
  SCANLINES_DEF,
  text,
  textWidth,
  wrap,
  type FontData,
} from "./svg.ts";
import type { Theme } from "./theme.ts";

/** GitHub's README column is about 830px wide on desktop; the images scale down on phones. */
export const WIDTH = 830;
/** Room for a card's hard shadow. */
const SHADOW = 6;
const GAP = 20;

const BODY = { font: "term", size: 20, lineHeight: 21 } as const;

type Ctx = { theme: Theme; fonts: FontData; logo: (tech: string) => PixelLogo };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Same as formatMonth in apps/web/src/lib/profile.ts. */
export function formatMonth(ym: string | null | undefined): string {
  if (!ym) return "Present";
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** Same as codename in apps/web/src/lib/profile.ts: the title up to its colon or dash, else the id. */
export function codename(title: string, id: string): string {
  const head = title.split(/\s*[:—]\s*/)[0]!.trim();
  return (head.length <= 16 ? head : id.replace(/-/g, " ")).toUpperCase();
}

const finish = (w: number, h: number, body: string, title: string, c: Ctx) =>
  doc(w, h, (c.theme.scanlines ? SCANLINES_DEF : "") + body, { fonts: ["retro", "term", "pixel"], data: c.fonts, title });

// ───────────── typing line ─────────────

/**
 * A terminal prompt that types each line, holds it, clears, and moves on, forever. SMIL, so it
 * runs inside an <img>: a clip rect grows a character at a time and the cursor follows it.
 */
export function renderTyping(phrases: string[], c: Ctx): string {
  const t = c.theme;
  const h = 58;
  const size = 24;
  const cw = textWidth("x", "term", size);
  const x0 = 54;
  const maxChars = Math.floor((WIDTH - SHADOW - x0 - 24) / cw);
  const rows = phrases.map((p) => clip(p, "term", size, maxChars * cw));
  const TYPE = 0.045;
  const HOLD = 2.4;
  const GAP_S = 0.5;
  const spans = rows.map((r) => [...r].length * TYPE + HOLD + GAP_S);
  const total = spans.reduce((a, b) => a + b, 0);
  const f = (s: number) => (s / total).toFixed(5);

  const dur = `${total.toFixed(2)}s`;
  const anim = (attr: string, values: (string | number)[], keyTimes: string) =>
    `<animate attributeName="${attr}" values="${values.join(";")}" keyTimes="${keyTimes}" dur="${dur}" calcMode="discrete" repeatCount="indefinite"/>`;

  let t0 = 0;
  const out: string[] = [];
  rows.forEach((row, i) => {
    const n = [...row].length;
    // [time, typed width, cursor visible]: hidden before its turn, typed a character at a time, held, then cleared.
    const steps: [number, number, number][] = [];
    if (t0 > 0) steps.push([0, 0, 0]);
    steps.push([t0, 0, 1]);
    for (let k = 1; k <= n; k++) steps.push([t0 + k * TYPE, k * cw, 1]);
    steps.push([t0 + n * TYPE + HOLD, 0, 0]);
    const kt = steps.map(([s]) => f(s)).join(";");
    out.push(
      `<clipPath id="c${i}"><rect x="${x0}" y="0" width="0" height="${h}">${anim("width", steps.map(([, w]) => w.toFixed(1)), kt)}</rect></clipPath>` +
        `<g clip-path="url(#c${i})">${text(x0, 37, row, { font: "term", size, fill: t.term.text })}</g>` +
        `<rect x="${x0}" y="17" width="${cw.toFixed(1)}" height="22" fill="${t.term.text}" opacity="0">` +
        anim("x", steps.map(([, w]) => (x0 + w).toFixed(1)), kt) +
        anim("opacity", steps.map(([, , v]) => v), kt) +
        `</rect>`,
    );
    t0 += spans[i]!;
  });

  const frame =
    t.mode === "light"
      ? `<rect x="4" y="4" width="${WIDTH - SHADOW}" height="${h - SHADOW}" fill="${t.shadow}"/>` +
        `<rect x="1" y="1" width="${WIDTH - SHADOW - 2}" height="${h - SHADOW - 2}" fill="${t.term.bg}" stroke="${t.term.border}" stroke-width="2"/>`
      : `<rect x="0.5" y="0.5" width="${WIDTH - SHADOW - 1}" height="${h - SHADOW - 1}" fill="${t.term.bg}" stroke="${t.term.border}" stroke-width="1"/>` +
        `<rect width="${WIDTH - SHADOW}" height="${h - SHADOW}" fill="url(#scan)"/>`;
  const prompt = text(22, 37, t.mode === "light" ? ">" : "$", { font: "term", size, fill: t.term.prompt });
  return finish(WIDTH, h, frame + prompt + out.join(""), phrases.join(" · "), c);
}

// ───────────── Now / Open to ─────────────

export function renderNow(p: Profile, c: Ctx): string | null {
  const t = c.theme;
  const current = p.experience.find((e) => e.end === null);
  const openTo = p.identity.open_to;
  if (!current && !openTo) return null;
  const full = WIDTH - SHADOW;
  const leftW = current && openTo ? 500 : full;
  const rightW = current && openTo ? full - leftW - GAP : full;

  const cards: { label: string; w: number; body: string; h: number; badge?: { text: string; fill: string } }[] = [];
  if (current) {
    const inner = leftW - CARD_PAD * 2;
    const role = wrap(`${current.role} @ ${current.org}`, "pixel", 19, inner);
    const r = lines(CARD_PAD, CARD_HEAD + 8, role, { font: "pixel", size: 19, weight: 600, fill: t.text, lineHeight: 24 });
    let y = r.bottom + 28;
    const hl = current.highlights[0] ? wrap(current.highlights[0], BODY.font, BODY.size, inner) : [];
    const b = lines(CARD_PAD, y, hl, { ...BODY, fill: t.soft });
    if (hl.length) y = b.bottom + 30;
    const since = text(CARD_PAD, y, `▸ since ${formatMonth(current.start)}`, { font: "term", size: 18, fill: t.link });
    cards.push({ label: "Now", w: leftW, body: r.svg + b.svg + since, h: y + 18, badge: { text: "ON DUTY", fill: t.ok } });
  }
  if (openTo) {
    const body = wrap(openTo, BODY.font, BODY.size, rightW - CARD_PAD * 2 - 30);
    const mail = text(CARD_PAD, CARD_HEAD + 10, "📬", { font: "term", size: 22, fill: t.text });
    const b = lines(CARD_PAD + 30, CARD_HEAD + 8, body, { ...BODY, fill: t.text });
    const cta = text(CARD_PAD, b.bottom + 34, "▸ say hi below", { font: "term", size: 18, fill: t.link });
    cards.push({ label: "Open to", w: rightW, body: mail + b.svg + cta, h: b.bottom + 34 + 18 });
  }

  const h = Math.max(...cards.map((q) => q.h));
  let x = 0;
  const svg = cards
    .map((q, i) => {
      const out =
        card({ x, y: 6, w: q.w, h, label: q.label, theme: t, pin: i, badge: q.badge }) + `<g transform="translate(${x} 6)">${q.body}</g>`;
      x += q.w + GAP;
      return out;
    })
    .join("");
  return finish(WIDTH, h + 6 + SHADOW, svg, cards.map((q) => q.label).join(" · "), c);
}

// ───────────── featured builds ─────────────

/** Width of one build card; three sit side by side. */
export const BUILD_W = Math.floor((WIDTH - 2 * 14) / 3);

interface BuildLayout {
  head: string[];
  tagline: string[];
  tags: string[];
}

function buildLayout(p: Profile["projects"][number]): BuildLayout {
  const inner = BUILD_W - SHADOW - CARD_PAD * 2;
  return {
    head: wrap(codename(p.title, p.id), "retro", 12, inner),
    tagline: wrap(p.tagline, BODY.font, 19, inner),
    tags: p.tags.slice(0, 3),
  };
}

/** One height for every build card, so the row lines up. */
export function buildHeight(projects: Profile["projects"]): number {
  return Math.max(...projects.map((p) => buildBody(p, buildLayout(p), null).h));
}

function buildBody(p: Profile["projects"][number], L: BuildLayout, c: Ctx | null): { svg: string; h: number } {
  const t = c?.theme;
  const inner = BUILD_W - SHADOW - CARD_PAD * 2;
  let y = CARD_HEAD + 10;
  const out: string[] = [];
  const head = L.head.map((line, i) => (t ? text(CARD_PAD, y + i * 18, line, { font: "retro", size: 12, fill: t.text }) : "")).join("");
  out.push(head);
  y += (L.head.length - 1) * 18 + 22;
  const range = p.start ? `${formatMonth(p.start)} – ${formatMonth(p.end === undefined ? p.date : p.end)}` : formatMonth(p.date);
  if (t) out.push(text(CARD_PAD, y, range, { font: "term", size: 18, fill: t.soft }));
  y += 26;
  if (t) out.push(lines(CARD_PAD, y, L.tagline, { font: "term", size: 19, lineHeight: 20, fill: t.text }).svg);
  y += (L.tagline.length - 1) * 20 + 18;
  // Tag chips, one per row so long names never overflow.
  for (const tag of L.tags) {
    const label = clip(tag, "retro", 9, inner - chipWidth("") - 4);
    if (t && c) out.push(chip(label, c.logo(tag), CARD_PAD, y, t).svg);
    y += 36;
  }
  y += 10;
  if (t) out.push(text(CARD_PAD, y, "▶ READ THE DEBRIEF", { font: "retro", size: 8, fill: t.label }));
  return { svg: out.join(""), h: y + 18 };
}

export function renderBuild(p: Profile["projects"][number], h: number, pin: number, c: Ctx): string {
  const t = c.theme;
  const active = p.end === null;
  const L = buildLayout(p);
  const body =
    card({ x: 0, y: 6, w: BUILD_W - SHADOW, h, label: "Build", theme: t, pin, badge: { text: active ? "ACTIVE" : "COMPLETE", fill: active ? t.ok : t.soft } }) +
    `<g transform="translate(0 6)">${buildBody(p, L, c).svg}</g>`;
  return finish(BUILD_W, h + 6 + SHADOW, body, `${p.title}: ${p.tagline}`, c);
}

// ───────────── stack ─────────────

/** Every skill group as pixel-logo StackChips, the Dev Center's Stack. Maths gets chips too. */
export function renderStack(p: Profile, c: Ctx): string {
  const t = c.theme;
  const w = WIDTH - SHADOW;
  const inner = w - CARD_PAD * 2;
  let y = CARD_HEAD + 6;
  const out: string[] = [];
  const groups = [...p.skills].sort((a, b) => Number(NON_STACK_GROUPS.includes(a.group)) - Number(NON_STACK_GROUPS.includes(b.group)));
  for (const g of groups) {
    out.push(text(CARD_PAD, y + 10, `${g.group}`.toUpperCase(), { font: "retro", size: 8, fill: t.soft }));
    y += 20;
    const flow = chipFlow(
      g.items.map((name) => ({ label: name, logo: c.logo(name) })),
      CARD_PAD,
      y,
      inner,
      t,
    );
    out.push(flow.svg);
    y = flow.bottom + 22;
  }
  const h = y;
  const body = card({ x: 0, y: 6, w, h, label: "Toolbelt", theme: t, pin: 2 }) + `<g transform="translate(0 6)">${out.join("")}</g>`;
  return finish(WIDTH, h + 6 + SHADOW, body, `Stack: ${p.skills.flatMap((g) => g.items).join(", ")}`, c);
}

// ───────────── achievements and side quests ─────────────

export function renderAchievements(p: Profile, c: Ctx, shown = 5): string {
  const t = c.theme;
  const leftW = 480;
  const rightW = WIDTH - SHADOW - leftW - GAP;
  const parts: string[] = [];

  // Achievements, in the order the profile lists them (headline ones first), like the About page.
  let y = CARD_HEAD + 8;
  const left: string[] = [];
  for (const h of p.honors.slice(0, shown)) {
    const rows = wrap(h.title, BODY.font, BODY.size, leftW - CARD_PAD * 2 - 26);
    left.push(text(CARD_PAD, y, "★", { font: "term", size: 20, fill: t.accent }));
    left.push(lines(CARD_PAD + 22, y, rows, { ...BODY, fill: t.text }).svg);
    y += (rows.length - 1) * BODY.lineHeight + 18;
    left.push(text(CARD_PAD + 22, y, h.org, { font: "term", size: 16, fill: t.soft }));
    y += 26;
  }
  const more = p.honors.length - shown;
  if (more > 0) {
    left.push(text(CARD_PAD, y + 2, `+${more} more at si-dan.com/about`, { font: "term", size: 18, fill: t.link }));
    y += 24;
  }
  const leftH = y;

  // Side quests: each interest's emoji, title and blurb.
  y = CARD_HEAD + 8;
  const right: string[] = [];
  for (const q of p.interests) {
    if (q.emoji) right.push(text(CARD_PAD, y + 2, q.emoji, { font: "term", size: 20, fill: t.text }));
    const title = wrap(q.title, "pixel", 17, rightW - CARD_PAD * 2 - 30);
    right.push(lines(CARD_PAD + 30, y, title, { font: "pixel", size: 17, weight: 600, fill: t.text, lineHeight: 21 }).svg);
    y += (title.length - 1) * 21 + 22;
    const blurb = wrap(q.blurb, BODY.font, 18, rightW - CARD_PAD * 2);
    right.push(lines(CARD_PAD, y, blurb, { font: "term", size: 18, lineHeight: 19, fill: t.soft }).svg);
    y += (blurb.length - 1) * 19 + 30;
  }
  const rightH = y - 8;

  const h = Math.max(leftH, rightH);
  parts.push(card({ x: 0, y: 6, w: leftW, h, label: "Achievements", theme: t, pin: 1 }));
  parts.push(`<g transform="translate(0 6)">${left.join("")}</g>`);
  if (p.interests.length) {
    parts.push(card({ x: leftW + GAP, y: 6, w: rightW, h, label: "Side quests", theme: t, pin: 3 }));
    parts.push(`<g transform="translate(${leftW + GAP} 6)">${right.join("")}</g>`);
  }
  return finish(WIDTH, h + 6 + SHADOW, parts.join(""), `Achievements: ${p.honors.slice(0, shown).map((h) => h.title).join(", ")}`, c);
}

// ───────────── buttons ─────────────

/**
 * A chunky pixel button with stepped corners and a sticker shadow, like the site's .btn but square.
 * `primary` is the coral call to action.
 */
export function renderButton(label: string, c: Ctx, { primary = false, size = 10 } = {}): string {
  const t = c.theme;
  const pad = primary ? 22 : 14;
  const w = Math.ceil(textWidth(label, "retro", size) + pad * 2 + 4);
  const h = primary ? 50 : 40;
  const fill = primary ? (t.mode === "light" ? "#ff7a59" : "#ffc857") : t.card;
  const ink = primary ? (t.mode === "light" ? "#ffffff" : "#0b1020") : t.text;
  const edge = t.mode === "light" ? t.border : primary ? "#ffc857" : t.chipBorder;
  const step = (x: number, y: number, bw: number, bh: number, col: string) =>
    `<rect x="${x + 4}" y="${y}" width="${bw - 8}" height="${bh}" fill="${col}"/><rect x="${x}" y="${y + 4}" width="${bw}" height="${bh - 8}" fill="${col}"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="${bw - 4}" height="${bh - 4}" fill="${col}"/>`;
  const body =
    step(0, 4, w, h - 4, t.shadow) +
    step(0, 0, w, h - 4, edge) +
    step(2, 2, w - 4, h - 8, fill) +
    text(w / 2, (h - 4) / 2 + size / 2, label, { font: "retro", size, fill: ink, anchor: "middle" });
  return doc(w, h, `<g shape-rendering="crispEdges">${body}</g>`, { fonts: ["retro"], data: c.fonts, title: label });
}

export { esc };
