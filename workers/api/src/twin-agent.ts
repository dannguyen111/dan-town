/**
 * The twin as a small agent: it can look at Dan's free/busy time and offer meeting slots.
 *
 * The tools are read-only. The model can't book anything or see a visitor's contact details:
 * slots it finds go to the browser as `slots` events (clickable chips), and the visitor's request
 * goes straight from a form to /api/twin/book, which re-checks everything server-side and waits for
 * Dan's approval. Tool arguments are validated with zod; anything off-schema runs nothing.
 *
 * Output is NDJSON, one event per line: {"t":"text","v":"…"} | {"t":"slots","v":[…]} | {"t":"error","v":"…"}
 */
import { z } from "zod";
import type { Env } from "./env.ts";
import { TWIN_NAME } from "./generated/twin-context.ts";
import { openrouter } from "./openrouter.ts";
import {
  bookableRange,
  checkTime,
  type Duration,
  ET,
  findSlots,
  type Interval,
  isTimeZone,
  parseLocal,
  REASON_TEXT,
  type Slot,
  toSlot,
} from "./schedule.ts";

import type { TwinEvent } from "./types.ts";
export type { TwinEvent };

export interface ToolContext {
  now: number;
  /** The visitor's IANA time zone, from their browser. */
  tz: string;
  /** Null when Google Calendar isn't configured. */
  freeBusy: ((from: number, to: number) => Promise<Interval[]>) | null;
  emit: (e: TwinEvent) => void;
}

const DAY = 86_400_000;
const FIRST = TWIN_NAME.split(" ")[0]!;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const duration = z.union([z.literal(15), z.literal(30)]);
const tz = z.string().refine(isTimeZone, "an IANA time zone such as America/Chicago");

const UNAVAILABLE = {
  available: false,
  note: "The calendar can't be reached right now. Say you can't check the schedule at the moment and suggest reaching out by email instead.",
};
const SUGGEST =
  "If nothing works for them, invite the visitor to suggest a time: Mon–Thu 7:30 AM to midnight ET or Fri 7:30 AM–5 PM ET, at least 24 hours ahead and within 14 days.";

const slotsForModel = (slots: Slot[]) => slots.map(({ et, local, duration, custom }) => ({ et, visitor_local: local, duration, ...(custom ? { custom } : {}) }));

/** Turns an ET calendar date into the UTC instant at midnight ET that starts it. */
const etMidnight = (d: string) => parseLocal(`${d}T00:00`, ET)!;

export const TOOLS = {
  check_availability: {
    description:
      `Find open meeting slots on ${FIRST}'s calendar (weekdays 9 AM–5 PM Eastern). Use ONLY when the visitor explicitly asks when ${FIRST} is free, or after a time they proposed didn't work. Matching slots are shown to the visitor as clickable buttons.`,
    args: z
      .object({
        from_date: date.optional().describe("First day to search (YYYY-MM-DD, Eastern). Defaults to the earliest bookable day."),
        to_date: date.optional().describe("Last day to search, inclusive (YYYY-MM-DD, Eastern). Defaults to a week later."),
        duration: duration.describe("15 (intro) or 30 (chat) minutes."),
        visitor_tz: tz.optional().describe("The visitor's IANA time zone if they mentioned one; otherwise omit to use their browser's."),
      })
      .strict(),
    async run(a: { from_date?: string; to_date?: string; duration: Duration; visitor_tz?: string }, ctx: ToolContext) {
      if (!ctx.freeBusy) return UNAVAILABLE;
      const range = bookableRange(ctx.now);
      const from = Math.max(a.from_date ? etMidnight(a.from_date) : range.start, range.start);
      const to = Math.min(a.to_date ? etMidnight(a.to_date) + DAY : from + 7 * DAY, range.end);
      if (to <= from) return { slots: [], note: "That range is outside the bookable window (24 hours to 14 days from now). " + SUGGEST };
      const busy = await ctx.freeBusy(from, to);
      const zone = a.visitor_tz ?? ctx.tz;
      const slots = findSlots({ from, to, duration: a.duration, busy, now: ctx.now }).map((s) => toSlot(s, a.duration, zone));
      if (!slots.length) return { slots: [], note: "No open slots in that range. Offer to look at other days. " + SUGGEST };
      ctx.emit({ t: "slots", v: slots });
      return {
        slots: slotsForModel(slots),
        note: "These now appear as buttons under your reply. Mention two or three briefly in the visitor's time zone (with ET); they click one to request it. Nothing is booked until " + FIRST + " approves. " + SUGGEST,
      };
    },
  },
  check_time: {
    description:
      `Check whether a specific time the visitor proposed works for ${FIRST}. If it does, the visitor gets a button to request it; if not, you get nearby alternatives (also shown as buttons).`,
    args: z
      .object({
        start_local: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "YYYY-MM-DDTHH:MM")
          .describe("Proposed start as wall-clock time in visitor_tz, e.g. 2026-10-07T19:30."),
        duration: duration.describe("15 (intro) or 30 (chat) minutes."),
        visitor_tz: tz.optional().describe("Time zone the visitor stated the time in, if not their browser's (e.g. America/New_York when they said ET)."),
      })
      .strict(),
    async run(a: { start_local: string; duration: Duration; visitor_tz?: string }, ctx: ToolContext) {
      if (!ctx.freeBusy) return UNAVAILABLE;
      const zone = a.visitor_tz ?? ctx.tz;
      const start = parseLocal(a.start_local, zone);
      if (start === null) return { ok: false, reason: "That isn't a valid date and time." };
      const range = bookableRange(ctx.now);
      // Look around the proposed time for alternatives, staying inside the bookable window.
      const from = Math.min(Math.max(start - DAY, range.start), range.end - 3 * DAY);
      const to = from + 4 * DAY;
      const busy = await ctx.freeBusy(Math.min(from, start), Math.max(to, start + a.duration * 60_000));
      const result = checkTime(start, a.duration, busy, ctx.now);
      if (result.ok) {
        const slot = toSlot(start, a.duration, zone, result.kind === "custom");
        ctx.emit({ t: "slots", v: [slot] });
        return {
          ok: true,
          slot: slotsForModel([slot])[0],
          note:
            "It's free, and it now appears as a button the visitor can click to request it. " + FIRST + " still has to approve it." +
            (result.kind === "custom" ? ` It's outside ${FIRST}'s usual 9–5, so mention ${FIRST} will confirm whether it works.` : ""),
        };
      }
      const alternatives = findSlots({ from, to, duration: a.duration, busy, now: ctx.now, limit: 3 }).map((s) => toSlot(s, a.duration, zone));
      if (alternatives.length) ctx.emit({ t: "slots", v: alternatives });
      return {
        ok: false,
        reason: REASON_TEXT[result.reason],
        alternatives: slotsForModel(alternatives),
        note: (alternatives.length ? "The alternatives now appear as buttons. " : "") + SUGGEST,
      };
    },
  },
} as const;

type ToolName = keyof typeof TOOLS;

export const TOOL_DEFS = Object.entries(TOOLS).map(([name, t]) => {
  const { $schema: _drop, ...parameters } = z.toJSONSchema(t.args) as Record<string, unknown>;
  return { type: "function" as const, function: { name, description: t.description, parameters } };
});

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** Runs one tool call. Never throws: errors become a result the model can explain to the visitor. */
export async function runTool(call: ToolCall, ctx: ToolContext): Promise<unknown> {
  const tool = TOOLS[call.name as ToolName];
  if (!tool) return { error: `Unknown tool ${call.name}.` };
  let raw: unknown;
  try {
    raw = JSON.parse(call.arguments || "{}");
  } catch {
    return { error: "Arguments were not valid JSON." };
  }
  const parsed = tool.args.safeParse(raw);
  if (!parsed.success) return { error: "Invalid arguments.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  try {
    return await tool.run(parsed.data as never, ctx);
  } catch (err) {
    console.error(`[twin] tool ${call.name} failed:`, err instanceof Error ? err.message : err);
    return UNAVAILABLE;
  }
}

// ───────────────────────────── streaming ─────────────────────────────

/** Parses OpenAI-style SSE into JSON frames, skipping comments, keep-alives and [DONE]. */
export async function* sseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<any> {
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (line: string) => {
    line = line.trim();
    if (!line.startsWith("data:")) return undefined; // comments such as ": OPENROUTER PROCESSING"
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return undefined;
    try {
      return JSON.parse(data);
    } catch {
      return undefined; // partial frames / keep-alives
    }
  };
  const reader = body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const frame = parse(line);
      if (frame !== undefined) yield frame;
    }
  }
  const last = parse(buffer + decoder.decode());
  if (last !== undefined) yield last;
}

/** Reads one streamed completion: text deltas go to `onText`, tool-call fragments are stitched together. */
export async function readCompletion(body: ReadableStream<Uint8Array>, onText: (s: string) => void): Promise<{ text: string; calls: ToolCall[] }> {
  let text = "";
  const calls: ToolCall[] = [];
  for await (const frame of sseFrames(body)) {
    const delta = frame?.choices?.[0]?.delta;
    if (!delta) continue;
    if (typeof delta.content === "string" && delta.content) {
      text += delta.content;
      onText(delta.content);
    }
    for (const tc of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
      const i = typeof tc.index === "number" ? tc.index : calls.length;
      const call = (calls[i] ??= { id: "", name: "", arguments: "" });
      if (tc.id) call.id = tc.id;
      if (tc.function?.name) call.name += tc.function.name;
      if (tc.function?.arguments) call.arguments += tc.function.arguments;
    }
  }
  return { text, calls: calls.filter((c) => c && c.name).map((c, i) => ({ ...c, id: c.id || `call_${i}` })) };
}

export interface AgentOptions {
  env: Env;
  /** Everything for /chat/completions except messages, stream and tools. */
  request: Record<string, unknown>;
  messages: unknown[];
  ctx: ToolContext;
  maxRounds?: number;
}

/**
 * Model → tools → model, at most `maxRounds` completions. The last round can't call tools, so the
 * visitor always gets an answer. Text streams to the visitor as it arrives in every round.
 */
export async function runAgent({ env, request, messages, ctx, maxRounds = 3 }: AgentOptions): Promise<void> {
  const convo = [...messages];
  let said = "";
  for (let round = 0; round < maxRounds; round++) {
    const res = await openrouter(env, "/chat/completions", {
      ...request,
      stream: true,
      messages: convo,
      tools: TOOL_DEFS,
      tool_choice: round === maxRounds - 1 ? "none" : "auto",
    });
    if (!res.ok || !res.body) {
      console.error("[twin] upstream error", res.status, await res.text().catch(() => ""));
      throw new Error(`upstream ${res.status}`);
    }
    // Keep sentences from separate rounds apart.
    let first = true;
    const { text, calls } = await readCompletion(res.body, (d) => {
      if (first && said && !/\s$/.test(said)) ctx.emit({ t: "text", v: "\n\n" });
      first = false;
      said += d;
      ctx.emit({ t: "text", v: d });
    });
    if (!calls.length) return;
    convo.push({
      role: "assistant",
      content: text || null,
      tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })),
    });
    for (const call of calls) {
      convo.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(await runTool(call, ctx)) });
    }
  }
}
