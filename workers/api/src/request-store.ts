/** The Durable Object holding song requests from the DJ booth. Logic and validation live in requests.ts. */
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.ts";
import type { SearchTrack, SongRequest } from "./types.ts";

export type RequestStatus = "pending" | "approved" | "rejected";

export interface StoredRequest extends SongRequest {
  /** Probability the note tries to instruct an AI (prompt injection), 0–1. */
  injection: number;
  /** Probability the note is spam or abuse, 0–1. */
  junk: number;
  status: RequestStatus;
}

// A type alias (not an interface) so it satisfies the SQL row's index signature.
type Row = {
  id: string;
  at: string;
  name: string;
  note: string;
  track: string;
  injection: number;
  junk: number;
  status: string;
};

const toRequest = (r: Row): StoredRequest => ({ ...r, track: JSON.parse(r.track) as SearchTrack, status: r.status as RequestStatus });

export class RequestStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      at TEXT NOT NULL,
      name TEXT NOT NULL,
      note TEXT NOT NULL,
      track TEXT NOT NULL,
      injection REAL NOT NULL DEFAULT 0,
      junk REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending'
    )`);
    ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS requests_at ON requests (at)");
  }

  /** Adds a request unless `dailyCap` already arrived in the last 24 hours. Returns null when full. */
  add(req: { id: string; at: string; name: string; note: string; track: SearchTrack }, dailyCap: number): StoredRequest | null {
    const since = new Date(Date.parse(req.at) - 86_400_000).toISOString();
    const { n } = this.ctx.storage.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM requests WHERE at > ?", since).one();
    if (n >= dailyCap) return null;
    this.ctx.storage.sql.exec("INSERT INTO requests (id, at, name, note, track) VALUES (?, ?, ?, ?, ?)", req.id, req.at, req.name, req.note, JSON.stringify(req.track));
    return this.get(req.id);
  }

  get(id: string): StoredRequest | null {
    const row = this.ctx.storage.sql.exec<Row>("SELECT * FROM requests WHERE id = ?", id).toArray()[0];
    return row ? toRequest(row) : null;
  }

  setVerdict(id: string, v: { injection: number; junk: number }): StoredRequest | null {
    this.ctx.storage.sql.exec("UPDATE requests SET injection = ?, junk = ? WHERE id = ?", v.injection, v.junk, id);
    return this.get(id);
  }

  setStatus(id: string, status: RequestStatus): StoredRequest | null {
    this.ctx.storage.sql.exec("UPDATE requests SET status = ? WHERE id = ?", status, id);
    return this.get(id);
  }

  /** The newest approved requests, for the chalkboard. */
  board(limit: number): SongRequest[] {
    return this.ctx.storage.sql
      .exec<Row>("SELECT * FROM requests WHERE status = 'approved' ORDER BY at DESC LIMIT ?", limit)
      .toArray()
      .map(toRequest)
      .map(({ id, at, name, note, track }) => ({ id, at, name, note, track }));
  }
}
