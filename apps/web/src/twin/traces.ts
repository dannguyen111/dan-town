/**
 * The computer's monitor at Home: a live terminal of how the twin answered recent visitors. Each row
 * is one reply: model rounds, tool calls, tokens, prompt-cache hits and latency, from
 * `GET /api/traces`. Open a row for its waterfall. Only timings and counts exist; nobody's words.
 */
import type { Trace, TraceRound, TracesResponse } from "@dan-town/api/types";

const POLL_MS = 4000;
const MINE = "twin-runs";

/** Remember this visitor's own run ids (from the chat's `run` events) to mark them "← you". */
export function rememberRun(id: string) {
  try {
    const ids = myRuns();
    ids.add(id);
    sessionStorage.setItem(MINE, JSON.stringify([...ids].slice(-50)));
  } catch {
    /* storage off: the rows just aren't marked */
  }
}

function myRuns(): Set<string> {
  try {
    const raw = JSON.parse(sessionStorage.getItem(MINE) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

// ───────────────────────────── formatting ─────────────────────────────

export const fmtMs = (ms: number | null) => (ms === null ? "–" : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);
export const fmtTok = (n: number | null) => (n === null ? "–" : n < 1000 ? String(n) : `${(n / 1000).toFixed(1)}k`);
export const fmtPct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
export const fmtCost = (usd: number | null) => (usd === null ? "–" : usd < 0.01 ? `${(usd * 100).toFixed(2)}¢` : `$${usd.toFixed(3)}`);
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/** "r1 0.4s 3.1k→58 ⚡84%": one round, compactly. */
export function roundSummary(r: TraceRound, i: number) {
  const cache = r.in && r.cached !== null ? ` ⚡${fmtPct(r.cached / r.in)}` : "";
  return `r${i + 1} ${fmtMs(r.ms)} ${fmtTok(r.in)}→${fmtTok(r.out)}${cache}`;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

// ───────────────────────────── the terminal ─────────────────────────────

export class TraceTerminal {
  private timer = 0;
  private seen = new Set<string>();
  private open = new Set<string>();
  private first = true;
  private readonly head: HTMLElement;
  private readonly rows: HTMLOListElement;
  private readonly status: HTMLElement;

  constructor(root: HTMLElement) {
    root.replaceChildren();
    this.head = el("div", "term__head");
    this.rows = el("ol", "term__rows");
    this.rows.setAttribute("aria-label", "Recent twin replies, newest first");
    this.status = el("p", "term__status");
    this.status.setAttribute("role", "status");
    const prompt = el("p", "term__prompt", "$ tail -f /api/traces");
    prompt.setAttribute("aria-hidden", "true");
    root.append(this.head, this.rows, prompt, this.status);
    this.renderHead(null);
  }

  private running = false;

  start() {
    this.stop();
    this.running = true;
    void this.poll();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
    document.removeEventListener("visibilitychange", this.resume);
  }

  /** Polling pauses in a background tab and picks up again when the visitor comes back. */
  private readonly resume = () => {
    if (!document.hidden && this.running) void this.poll();
  };

  private async poll() {
    document.removeEventListener("visibilitychange", this.resume);
    try {
      const res = await fetch("/api/traces", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as TracesResponse;
      if (!this.running) return;
      this.render(data);
      this.status.textContent = "";
    } catch {
      this.status.textContent = "connection lost · retrying…";
    }
    if (!this.running) return;
    this.timer = window.setTimeout(() => {
      if (document.hidden) document.addEventListener("visibilitychange", this.resume);
      else void this.poll();
    }, POLL_MS);
  }

  private render(data: TracesResponse) {
    this.renderHead(data);
    if (!data.traces.length) {
      const li = el("li", "term__empty");
      li.append("no runs yet. ", Object.assign(el("a", "", "Ask the twin something"), { href: "/twin" }), " and watch it show up here.");
      this.rows.replaceChildren(li);
      return;
    }
    const mine = myRuns();
    this.rows.replaceChildren(...data.traces.map((t) => this.row(t, mine.has(t.id), !this.first && !this.seen.has(t.id))));
    data.traces.forEach((t) => this.seen.add(t.id));
    this.first = false;
  }

  private renderHead(data: TracesResponse | null) {
    const s = data?.summary;
    const model = data?.traces[0]?.model ?? "…";
    const tools = s ? Object.entries(s.tools).sort((a, b) => b[1] - a[1]) : [];
    this.head.replaceChildren(
      line([["term__accent", "twin-agent"], ["term__dim", " · "], ["", model], ["term__dim", " · ZDR · tools: read-only calendar"]]),
      line([
        ["term__dim", "p50 "],
        ["", fmtMs(s?.p50Ms ?? null)],
        ["term__dim", "  p95 "],
        ["", fmtMs(s?.p95Ms ?? null)],
        ["term__dim", "  cache "],
        ["term__ok", fmtPct(s?.cacheHit ?? null)],
        ["term__dim", "  cost "],
        ["", `${fmtCost(s?.avgCost ?? null)}/reply`],
        ["term__dim", "  24h "],
        ["", String(s?.runs24h ?? "–")],
      ]),
      line([["term__dim", "tools "], ["", tools.length ? tools.map(([n, c]) => `${n}×${c}`).join("  ") : "none called yet"]]),
    );
  }

  private row(t: Trace, mine: boolean, fresh: boolean) {
    const li = el("li", `term__row${fresh ? " is-new" : ""}${mine ? " is-mine" : ""}`);
    const btn = el("button", "term__line");
    btn.type = "button";
    btn.setAttribute("aria-expanded", String(this.open.has(t.id)));
    const steps: [string, string][] = [];
    t.rounds.forEach((r, i) => {
      steps.push(["term__dim", " │ "], ["", roundSummary(r, i)]);
      for (const c of r.tools) steps.push(["term__dim", " → "], ["term__tool", `${c.name} ${fmtMs(c.ms)} `], [c.ok ? "term__ok" : "term__bad", c.ok ? "✓" : "✗"]);
    });
    btn.append(
      line([
        ["term__dim", `${clock(t.at)} `],
        ["term__id", t.id.slice(0, 4)],
        [t.ok ? "term__ok" : "term__bad", t.ok ? " ✓ " : " ✗ "],
        ["", fmtMs(t.totalMs)],
        ...steps,
        ...(mine ? ([["term__you", "  ← you"]] as [string, string][]) : []),
      ]),
    );
    btn.addEventListener("click", () => {
      if (this.open.has(t.id)) this.open.delete(t.id);
      else this.open.add(t.id);
      btn.setAttribute("aria-expanded", String(this.open.has(t.id)));
      li.querySelector(".wf")?.remove();
      if (this.open.has(t.id)) li.append(waterfall(t));
    });
    li.append(btn);
    if (this.open.has(t.id)) li.append(waterfall(t));
    return li;
  }
}

function line(parts: [string, string][]) {
  const p = el("span", "term__l");
  for (const [cls, text] of parts) p.append(cls ? el("span", cls, text) : document.createTextNode(text));
  return p;
}

/**
 * The run as a timeline: one bar per model round (the dim part is waiting for the first token)
 * and one per tool call, on a shared scale.
 */
function waterfall(t: Trace) {
  const total = Math.max(1, t.totalMs, ...t.rounds.map((r) => r.t0 + r.ms));
  const box = el("div", "wf");
  const pct = (ms: number) => `${Math.min(100, (ms / total) * 100).toFixed(2)}%`;
  const bar = (label: string, t0: number, ms: number, kind: "model" | "tool" | "bad", wait = 0, detail = "") => {
    const r = el("div", "wf__row");
    r.append(el("span", "wf__label", label));
    const track = el("span", "wf__track");
    const b = el("span", `wf__bar wf__bar--${kind}`);
    b.style.left = pct(t0);
    b.style.width = pct(Math.max(ms, total / 200));
    if (wait > 0) {
      const w = el("span", "wf__wait");
      w.style.width = `${Math.min(100, (wait / Math.max(ms, 1)) * 100).toFixed(1)}%`;
      b.append(w);
    }
    track.append(b);
    r.append(track, el("span", "wf__ms", fmtMs(ms)));
    if (detail) r.title = detail;
    box.append(r);
  };
  t.rounds.forEach((r, i) => {
    const detail = `first token ${fmtMs(r.ttftMs)} · in ${fmtTok(r.in)} (${fmtTok(r.cached)} cached) · out ${fmtTok(r.out)}`;
    bar(`model r${i + 1}`, r.t0, r.ms, "model", r.ttftMs ?? 0, detail);
    for (const c of r.tools) bar(`  ${c.name}`, c.t0, c.ms, c.ok ? "tool" : "bad");
  });
  const legend = el("p", "wf__legend");
  legend.textContent = `${t.rounds.length} round${t.rounds.length === 1 ? "" : "s"} · ${fmtCost(t.cost)} · dim = waiting for the first token · hover a bar for tokens`;
  box.append(legend);
  return box;
}
