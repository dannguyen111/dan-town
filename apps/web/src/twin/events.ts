/** Pure helpers for the twin chat: the NDJSON event stream and the tiny Markdown renderer. */
import type { TwinEvent } from "@dan-town/api/types";

/** Splits streamed text into complete NDJSON lines and parses each into an event. Bad lines are skipped. */
export class NdjsonParser {
  private buffer = "";

  push(chunk: string): TwinEvent[] {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    return lines.flatMap(parseLine);
  }

  flush(): TwinEvent[] {
    const rest = this.buffer;
    this.buffer = "";
    return parseLine(rest);
  }
}

function parseLine(line: string): TwinEvent[] {
  if (!line.trim()) return [];
  try {
    const e = JSON.parse(line);
    if ((e?.t === "text" || e?.t === "error") && typeof e.v === "string") return [e];
    if (e?.t === "slots" && Array.isArray(e.v)) return [e];
  } catch {
    /* skip */
  }
  return [];
}

/** Escapes text for HTML, quotes included so nothing can break out of an attribute. */
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Inline Markdown on one line: `code`, links, **bold** or __bold__, *italic* or _italic_, ~~strike~~. */
function inline(raw: string): string {
  // Code spans and links are stashed first, so emphasis rules never reach inside them (or a URL).
  const stash: string[] = [];
  const keep = (html: string) => `\u0000${stash.push(html) - 1}\u0000`;
  return escapeHtml(raw)
    .replace(/`([^`]+)`/g, (_, code: string) => keep(`<code>${code}</code>`))
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^)\s]+)\)/g, (_, label: string, href: string) =>
      keep(`<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`),
    )
    .replace(/\*\*(?=\S)(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\W)__(?=\S)(.+?)__(?!\w)/g, "$1<strong>$2</strong>")
    .replace(/~~(?=\S)(.+?)~~/g, "<del>$1</del>")
    .replace(/(^|[^\w*])\*(?=[^\s*])([^*]*?[^\s*])?\*(?![\w*])/g, (m, pre: string, body?: string) => (body === undefined ? m : `${pre}<em>${body}</em>`))
    .replace(/(^|\W)_(?=[^\s_])([^_]*?[^\s_])?_(?!\w)/g, (m, pre: string, body?: string) => (body === undefined ? m : `${pre}<em>${body}</em>`))
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => stash[Number(i)]!);
}

const FENCE = /^\s*```/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const BULLET = /^\s*[-*+•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,9})[.)]\s+(.*)$/;

/**
 * Escape, then render the Markdown chat models actually use: paragraphs, headings, bullet and
 * numbered lists, quotes, rules, code blocks, and the inline styles above. Safe on partial text,
 * since it re-renders on every streamed chunk (an unclosed code block shows what has arrived).
 */
export function renderMarkdown(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  const collect = (re: RegExp) => {
    const items: RegExpMatchArray[] = [];
    for (let m; i < lines.length && (m = lines[i]!.match(re)); i++) items.push(m);
    return items;
  };
  while (i < lines.length) {
    const line = lines[i]!;
    let m: RegExpMatchArray | null;
    if (!line.trim()) i++;
    else if (FENCE.test(line)) {
      const code: string[] = [];
      for (i++; i < lines.length && !FENCE.test(lines[i]!); i++) code.push(lines[i]!);
      i++; // the closing fence
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    } else if ((m = line.match(HEADING))) {
      // The page has its own h1/h2, so a reply's "#" starts at h3.
      const level = Math.min(m[1]!.length + 2, 6);
      out.push(`<h${level}>${inline(m[2]!)}</h${level}>`);
      i++;
    } else if (RULE.test(line)) {
      out.push("<hr>");
      i++;
    } else if (QUOTE.test(line)) {
      out.push(`<blockquote>${collect(QUOTE).map((q) => inline(q[1]!)).join("<br>")}</blockquote>`);
    } else if (BULLET.test(line)) {
      out.push(`<ul>${collect(BULLET).map((b) => `<li>${inline(b[1]!)}</li>`).join("")}</ul>`);
    } else if ((m = line.match(NUMBERED))) {
      const start = Number(m[1]);
      out.push(`<ol${start !== 1 ? ` start="${start}"` : ""}>${collect(NUMBERED).map((n) => `<li>${inline(n[2]!)}</li>`).join("")}</ol>`);
    } else {
      const para: string[] = [];
      for (; i < lines.length && lines[i]!.trim() && ![FENCE, HEADING, RULE, QUOTE, BULLET, NUMBERED].some((re) => re.test(lines[i]!)); i++) {
        para.push(inline(lines[i]!.trim()));
      }
      out.push(`<p>${para.join("<br>")}</p>`);
    }
  }
  return out.join("");
}

/** "Wed, Oct 7, 9:00 AM CDT" plus "(10:00 AM EDT)" when the visitor isn't on Eastern time. */
export function slotLabel(slot: { et: string; local: string }): { main: string; et: string | null } {
  if (slot.local === slot.et) return { main: slot.et, et: null };
  const etTime = slot.et.replace(/^.*?,\s*.*?,\s*/, ""); // "10:00 AM EDT"
  return { main: slot.local, et: etTime };
}
