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

/** Escape, then allow a tiny, safe subset of Markdown (bold, bullets, links). */
export function renderMarkdown(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const line of esc.split("\n")) {
    const m = line.match(/^\s*[-*•]\s+(.*)$/);
    if (m) list.push(m[1]!);
    else {
      flush();
      if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return out.join("");
}

/** "Wed, Oct 7, 9:00 AM CDT" plus "(10:00 AM EDT)" when the visitor isn't on Eastern time. */
export function slotLabel(slot: { et: string; local: string }): { main: string; et: string | null } {
  if (slot.local === slot.et) return { main: slot.et, et: null };
  const etTime = slot.et.replace(/^.*?,\s*.*?,\s*/, ""); // "10:00 AM EDT"
  return { main: slot.local, et: etTime };
}
