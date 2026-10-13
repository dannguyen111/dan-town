/**
 * The README's two looks, copied from apps/web/src/styles/global.css:
 *   light = the town (cream, paper notes, ink outlines, sticker shadows)
 *   dark  = the Dev Center's mission control (navy, cyan, amber, scanlines)
 *
 * Pure data, no Node or DOM: shared with the Worker's live cards.
 */

export type Mode = "light" | "dark";

export interface Theme {
  mode: Mode;
  /** Card fill and outline. */
  card: string;
  border: string;
  /** Hard offset shadow under cards and buttons. */
  shadow: string;
  /** Section labels ("NOW", "// NOW"). */
  label: string;
  /** Prefix before every label. */
  labelPrefix: string;
  text: string;
  soft: string;
  accent: string;
  accentInk: string;
  /** Second accent: links, highlights. */
  link: string;
  /** Good news (ACTIVE, the cursor in dark mode). */
  ok: string;
  chipBg: string;
  chipBorder: string;
  /** The coloured strip across a light card's top, or the cyan bar on a mission-control card. */
  topBar: string | null;
  /** Pushpin colours on light notes; null in dark mode. */
  pins: readonly string[] | null;
  /** Terminal bar (typing line). */
  term: { bg: string; border: string; text: string; prompt: string };
  /** Draw CRT scanlines over cards. */
  scanlines: boolean;
}

export const LIGHT: Theme = {
  mode: "light",
  card: "#ffffff",
  border: "#3b2f2a",
  shadow: "#3b2f2a",
  label: "#c4472a",
  labelPrefix: "",
  text: "#3b2f2a",
  soft: "#6f5f55",
  accent: "#ff7a59",
  accentInk: "#c4472a",
  link: "#17796e",
  ok: "#17796e",
  chipBg: "#ffffff",
  chipBorder: "#3b2f2a",
  topBar: null,
  pins: ["#ff7a59", "#2bb3a3", "#ffc857", "#7cc8f2"],
  term: { bg: "#f6ead6", border: "#3b2f2a", text: "#3b2f2a", prompt: "#c4472a" },
  scanlines: false,
};

export const DARK: Theme = {
  mode: "dark",
  card: "#111a33",
  border: "#26325c",
  shadow: "#070a14",
  label: "#3ee6ff",
  labelPrefix: "// ",
  text: "#dfe7ff",
  soft: "#8b9ac4",
  accent: "#ffc857",
  accentInk: "#ffc857",
  link: "#3ee6ff",
  ok: "#7dffb0",
  chipBg: "#0f1730",
  chipBorder: "#33416f",
  topBar: "#3ee6ff",
  pins: null,
  term: { bg: "#0b1020", border: "#3ee6ff", text: "#7dffb0", prompt: "#3ee6ff" },
  scanlines: true,
};

export const THEMES: Record<Mode, Theme> = { light: LIGHT, dark: DARK };

/** Town scenery (apps/web/src/town/world.ts). */
export const TOWN = {
  grass: "#9bd770",
  grassDark: "#86c75e",
  grassLight: "#b6e88b",
  path: "#f1d6a0",
  pathEdge: "#dfbd86",
  water: "#7cc8f2",
  waterLight: "#b3e2fa",
  canopy: "#4f9d4a",
  canopyLight: "#6dbb5b",
  canopyDark: "#3a7a3a",
  trunk: "#8a5a3b",
  window: "#bfe6ff",
  windowLit: "#ffd66b",
  ink: "#3b2a2a",
  flowers: ["#ff8fab", "#ffd166", "#ffffff", "#c49bff"],
  wood: "#8a5a34",
  woodFrame: "#a8703f",
  plaque: "#6b4226",
  buildings: {
    home: { wall: "#fff1d6", roof: "#e76f51", roofDark: "#c0533a", trim: "#f4a261" },
    dev: { wall: "#e8f1ff", roof: "#4a7bd1", roofDark: "#355fa8", trim: "#9dc0ff" },
    lab: { wall: "#f2f7f5", roof: "#3f8f7a", roofDark: "#2d6b5b", trim: "#9fe0cc" },
    music: { wall: "#f6e7c8", roof: "#7a2e2e", roofDark: "#5c2121", trim: "#e0a526" },
    arcade: { wall: "#3a3160", roof: "#ff7a59", roofDark: "#d95a3c", trim: "#59f0d0" },
  },
} as const;
