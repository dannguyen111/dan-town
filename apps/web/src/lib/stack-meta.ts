/**
 * Hand-tuned data for the pixel tech logos. Logos come from simple-icons, pixelated at build time
 * by scripts/pixel-logos.ts; this file says which icon each of Dan's techs uses, fixes brand colours
 * that don't work, and holds hand-drawn logos for brands simple-icons doesn't carry (or that pixelate
 * badly).
 *
 * Pure data, no DOM and no Node: shared by the build script and the site.
 */

/** Logos are drawn on a square grid this many pixels wide. */
export const LOGO_GRID = 12;

/**
 * Which simple-icons slug a tech uses, when its name isn't simply the icon's title. null means
 * "no icon": the tech gets a lettered tile (see monogram() in stack.ts).
 */
export const STACK_ALIASES: Record<string, string | null> = {
  "HTML/CSS": "html5",
  HTML: "html5",
  "Phoenix LiveView": "phoenixframework",
  "Stripe API": "stripe",
  "Stripe Connect": "stripe",
  "Claude Code": "claude",
  Codex: null,
  Whisper: null,
  LLMs: null,
  // simple-icons' "Delta" is the airline, not Delta Lake.
  "Delta Lake": null,
};

/** Brand colours, where simple-icons has none (or one that disappears in a chip). */
export const STACK_HEX: Record<string, string> = {
  Java: "#ED8B00",
  AWS: "#FF9900",
  "AWS Bedrock": "#01A88D",
  "AWS S3": "#569A31",
  "Azure DevOps": "#0078D7",
  Excel: "#217346",
  "OpenAI SDK": "#10A37F",
  "Groq API": "#F55036",
  Groq: "#F55036",
  Matplotlib: "#11557C",
  Ecto: "#4B275F",
  ExUnit: "#4B275F",
  LlamaIndex: "#8A4FFF",
  "Delta Lake": "#00ADD4",
  Whisper: "#10A37F",
  Codex: "#10A37F",
  "Claude Code": "#D97757",
};

/**
 * Hand-drawn logos, LOGO_GRID square. Legend:  # brand colour · o white · . transparent
 * These win over simple-icons, so they also fix logos that turn to mush at this size.
 */
export const STACK_ROWS: Record<string, readonly string[]> = {
  // A steaming coffee cup.
  Java: [
    "....#..#....",
    "...#..#.....",
    "....#..#....",
    "...#..#.....",
    "............",
    ".#########..",
    ".#########.#",
    ".#########.#",
    ".#########..",
    "..#######...",
    "#.........#.",
    ".#########..",
  ],
  // The smile arrow under "aws".
  AWS: [
    "............",
    "..##.#.#.##.",
    ".#.#.#.#.#..",
    ".###.#.#..#.",
    ".#.#..#..##.",
    "............",
    "............",
    "#.........#.",
    ".#.......#.#",
    "..#######..#",
    "..........##",
    "............",
  ],
  // A spreadsheet with the X.
  Excel: [
    "############",
    "#oooooo#...#",
    "#o#oo#o#...#",
    "#oo##oo#####",
    "#oo##oo#...#",
    "#o#oo#o#...#",
    "#oooooo#####",
    "#......#...#",
    "#......#...#",
    "############",
    "............",
    "............",
  ],
};

/** Skill groups that aren't software, so they never get logos or radar blips. */
export const NON_STACK_GROUPS = ["Mathematics"];

/** Names that mean the same tech, folded together when counting where a tech was used. */
export const STACK_CANONICAL: Record<string, string> = {
  "Stripe API": "Stripe",
  "Stripe Connect": "Stripe",
  "Groq API": "Groq",
  HTML: "HTML/CSS",
  "LLM-as-a-judge": "LLM Evals (LLM-as-a-judge)",
  "Fine-tuning": "LLM Fine-Tuning",
  "AWS S3": "AWS",
};
export const canonicalTech = (name: string) => STACK_CANONICAL[name] ?? name;

// ───────────── lettered tiles, for techs without a logo ─────────────

/** A 3×5 pixel font: the letters on lettered tiles, and the Dev Center's screens. */
export const PIXEL_FONT: Record<string, readonly string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."], K: ["#.#", "#.#", "##.", "#.#", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"], O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."], Q: [".#.", "#.#", "#.#", "##.", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."], U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."], W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"],
  "0": ["###", "#.#", "#.#", "#.#", "###"], "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."], "4": ["#.#", "#.#", "###", "..#", "..#"], "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".##", "#..", "###", "#.#", "###"], "7": ["###", "..#", ".#.", ".#.", ".#."], "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "##."],
  ":": ["...", ".#.", "...", ".#.", "..."], "-": ["...", "...", "###", "...", "..."], ".": ["...", "...", "...", "...", ".#."],
  "/": ["..#", "..#", ".#.", "#..", "#.."], "&": [".#.", "#.#", ".#.", "#.#", ".##"], "+": ["...", ".#.", "###", ".#.", "..."],
};
const FONT = PIXEL_FONT;

/** Up to two letters for a tech: the first letters of its first two words, else its first two letters. */
export function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  if (!words.length) return "?";
  const pick = words.length > 1 ? words[0]![0]! + words[1]![0]! : words[0]!.slice(0, 2);
  return pick.toUpperCase();
}

/** A brand-coloured rounded tile with the tech's initials knocked out in white. */
export function monogram(name: string): string[] {
  const n = LOGO_GRID;
  const rows: string[][] = Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => ((x === 0 || x === n - 1) && (y === 0 || y === n - 1) ? "." : "#")),
  );
  const letters = [...initials(name)].filter((c) => FONT[c]);
  const width = letters.length * 4 - 1;
  const left = Math.floor((n - width) / 2);
  const top = Math.floor((n - 5) / 2);
  letters.forEach((c, i) =>
    FONT[c]!.forEach((line, dy) => [...line].forEach((px, dx) => px === "#" && (rows[top + dy]![left + i * 4 + dx] = "o"))),
  );
  return rows.map((r) => r.join(""));
}

/** A steady colour per name, for lettered tiles with no brand colour on file. */
export function hashColour(name: string): string {
  const palette = ["#5b8def", "#e0679b", "#2fa57a", "#d9822b", "#8f6ad8", "#2a9bb5", "#c4513c", "#6c8a2e"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length]!;
}

/** Relative luminance (0 dark … 1 light) of a #rrggbb colour. */
export function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
