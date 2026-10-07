/**
 * Run traces for the computer at Home: every twin reply records how it was made (rounds, tool calls,
 * tokens, cache hits, latency) and `GET /api/traces` shows the recent ones with a small summary.
 * Nothing a visitor typed, and nothing about who they are, is ever stored.
 */
import type { Env } from "./env.ts";
import type { Trace, TraceSummary, TracesResponse } from "./types.ts";

/** How many traces the desk shows. The summary uses everything the store keeps. */
export const SHOWN = 50;
const DAY = 86_400_000;

const store = (env: Env) => env.TRACES.get(env.TRACES.idFromName("twin"));

/** Saves a finished trace. Never throws: losing a trace must not affect the reply. */
export async function recordTrace(env: Env, trace: Trace): Promise<void> {
  try {
    await store(env).append(trace);
  } catch (err) {
    console.warn("[traces] could not save:", err instanceof Error ? err.message : err);
  }
}

/** The value at fraction `q` of an ascending list (nearest rank). */
export function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))]!;
}

export function summarize(traces: Trace[], now: number): TraceSummary {
  const ms = traces.filter((t) => t.ok).map((t) => t.totalMs).sort((a, b) => a - b);
  let prompt = 0;
  let cached = 0;
  let costSum = 0;
  let costed = 0;
  const tools: Record<string, number> = {};
  for (const t of traces) {
    for (const r of t.rounds) {
      if (r.in !== null) {
        prompt += r.in;
        cached += r.cached ?? 0;
      }
      for (const call of r.tools) tools[call.name] = (tools[call.name] ?? 0) + 1;
    }
    if (t.cost !== null) {
      costSum += t.cost;
      costed++;
    }
  }
  return {
    runs24h: traces.filter((t) => now - Date.parse(t.at) < DAY).length,
    p50Ms: quantile(ms, 0.5),
    p95Ms: quantile(ms, 0.95),
    cacheHit: prompt ? cached / prompt : null,
    avgCost: costed ? costSum / costed : null,
    tools,
  };
}

export async function readTraces(env: Env, now = Date.now()): Promise<TracesResponse> {
  const traces = await store(env).recent();
  return { summary: summarize(traces, now), traces: traces.slice(0, SHOWN) };
}
