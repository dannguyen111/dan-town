/** The Durable Object holding the twin's recent run traces. Summaries and the route live in traces.ts. */
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.ts";
import type { Trace } from "./types.ts";

/** Enough history for a day's stats on a personal site; older runs are dropped on write. */
export const KEEP = 200;

type Row = { id: string; at: string; json: string };

export class TraceStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS traces (id TEXT PRIMARY KEY, at TEXT NOT NULL, json TEXT NOT NULL)");
    ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS traces_at ON traces (at)");
  }

  append(trace: Trace): void {
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO traces (id, at, json) VALUES (?, ?, ?)", trace.id, trace.at, JSON.stringify(trace));
    this.ctx.storage.sql.exec("DELETE FROM traces WHERE id NOT IN (SELECT id FROM traces ORDER BY at DESC LIMIT ?)", KEEP);
  }

  /** All kept traces, newest first. */
  recent(): Trace[] {
    return this.ctx.storage.sql
      .exec<Row>("SELECT id, at, json FROM traces ORDER BY at DESC")
      .toArray()
      .map((r) => JSON.parse(r.json) as Trace);
  }
}
