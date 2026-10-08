/**
 * Crate Match's result card: a small pixel-art PNG to save or share, drawn on a canvas in the shop's
 * colours and fonts (Monoton for the score, Press Start 2P for labels, VT323 for the rest).
 */
import type { MatchResult } from "@dan-town/api/types";

const W = 600;
const H = 340;
const C = { bg: "#1d1414", panel: "#2a1b1b", line: "#5a3030", mustard: "#e0a526", pink: "#ff6fae", cream: "#f6e7c8", dim: "#c9a98a" };

/** The font family list behind one of the site's CSS font variables, e.g. --font-retro. */
const family = (cssVar: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || fallback;

/** Cut a line to fit `max` pixels, with an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

export async function drawCard(result: MatchResult, opts: { first: string; site: string }): Promise<HTMLCanvasElement> {
  const neon = family("--font-neon", "serif");
  const retro = family("--font-retro", "monospace");
  const term = family("--font-terminal", "monospace");
  // Canvas text uses whatever is loaded right now, so wait for the three faces.
  await Promise.all([`40px ${neon}`, `12px ${retro}`, `20px ${term}`].map((f) => document.fonts.load(f).catch(() => [])));

  const canvas = document.createElement("canvas");
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.imageSmoothingEnabled = false;

  // Background: wallpaper pinstripes, a mustard frame with a hard shadow.
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#241818";
  for (let x = 0; x < W; x += 12) ctx.fillRect(x, 0, 4, H);
  ctx.fillStyle = C.mustard;
  ctx.fillRect(12, 12, W - 24, H - 24);
  ctx.fillStyle = C.panel;
  ctx.fillRect(18, 18, W - 36, H - 36);

  // A record in the corner, label and all.
  const rx = W - 92;
  const ry = 92;
  ctx.fillStyle = "#0d0808";
  ctx.beginPath();
  ctx.arc(rx, ry, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a2020";
  ctx.lineWidth = 1;
  for (let r = 22; r < 56; r += 5) {
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = C.pink;
  ctx.beginPath();
  ctx.arc(rx, ry, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.bg;
  ctx.beginPath();
  ctx.arc(rx, ry, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.textBaseline = "top";
  ctx.fillStyle = C.dim;
  ctx.font = `10px ${retro}`;
  ctx.fillText(`CRATE MATCH · YOU × ${opts.first.toUpperCase()}`, 36, 36);

  // The score, glowing.
  ctx.font = `76px ${neon}`;
  ctx.shadowColor = C.pink;
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffd6ea";
  ctx.fillText(`${result.score}%`, 32, 58);
  ctx.shadowBlur = 0;

  ctx.fillStyle = C.mustard;
  ctx.font = `14px ${retro}`;
  ctx.fillText(fit(ctx, result.verdict.toUpperCase(), W - 220), 36, 150);

  // The match meter: 20 LED blocks.
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = i < Math.round(result.score / 5) ? (i < 12 ? C.mustard : C.pink) : C.line;
    ctx.fillRect(36 + i * 17, 176, 13, 10);
  }

  ctx.font = `20px ${term}`;
  let y = 202;
  const line = (label: string, text: string) => {
    ctx.fillStyle = C.dim;
    ctx.fillText(label, 36, y);
    ctx.fillStyle = C.cream;
    ctx.fillText(fit(ctx, text, W - 36 - 150), 150, y);
    y += 24;
  };
  if (result.shared.length) line("Both play", result.shared.join(" · "));
  if (result.neighbours.length) line("Neighbours", result.neighbours.map((n) => `${n.yours} ↔ ${n.mine}`).join(" · "));
  if (result.sharedTags.length) line("Shared sound", result.sharedTags.join(" · "));
  if (result.pick && y < H - 70) line("For you", `${result.pick.name} — ${result.pick.artists}`);

  ctx.fillStyle = C.dim;
  ctx.font = `8px ${retro}`;
  ctx.fillText(`${opts.site.replace(/^https?:\/\//, "")}/music · find your match at the record crates`, 36, H - 44);
  return canvas;
}

export const toPng = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
