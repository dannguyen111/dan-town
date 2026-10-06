/** The Durable Object holding fridge notes. Logic and validation live in fridge.ts. */
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.ts";
import type { FridgeNote, FridgeTopic } from "./types.ts";

export type FridgeStatus = "pending" | "approved" | "rejected";

/** What Jev said about a note. */
export interface FridgeVerdict {
  topic: FridgeTopic;
  /** Jev's confidence in the topic, 0–1. */
  confidence: number;
  /** Probability the note tries to instruct an AI (prompt injection), 0–1. */
  injection: number;
  /** Probability the note is spam or abuse, 0–1. */
  junk: number;
}

export interface StoredNote extends FridgeNote, Omit<FridgeVerdict, "topic"> {
  contact: string;
  status: FridgeStatus;
}

// A type alias (not an interface) so it satisfies the SQL row's index signature.
type Row = {
  id: string;
  at: string;
  name: string;
  message: string;
  contact: string;
  topic: string;
  confidence: number;
  injection: number;
  junk: number;
  status: string;
};

const toNote = (r: Row): StoredNote => ({ ...r, topic: r.topic as FridgeTopic, status: r.status as FridgeStatus });

export class FridgeStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      at TEXT NOT NULL,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      contact TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT 'unsorted',
      confidence REAL NOT NULL DEFAULT 0,
      injection REAL NOT NULL DEFAULT 0,
      junk REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending'
    )`);
    ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS notes_at ON notes (at)");
  }

  /** Adds a note unless `dailyCap` notes already arrived in the last 24 hours. Returns null when full. */
  add(note: { id: string; at: string; name: string; message: string; contact: string }, dailyCap: number): StoredNote | null {
    const since = new Date(Date.parse(note.at) - 86_400_000).toISOString();
    const { n } = this.ctx.storage.sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM notes WHERE at > ?", since).one();
    if (n >= dailyCap) return null;
    this.ctx.storage.sql.exec("INSERT INTO notes (id, at, name, message, contact) VALUES (?, ?, ?, ?, ?)", note.id, note.at, note.name, note.message, note.contact);
    return this.get(note.id);
  }

  get(id: string): StoredNote | null {
    const row = this.ctx.storage.sql.exec<Row>("SELECT * FROM notes WHERE id = ?", id).toArray()[0];
    return row ? toNote(row) : null;
  }

  setVerdict(id: string, v: FridgeVerdict): StoredNote | null {
    this.ctx.storage.sql.exec("UPDATE notes SET topic = ?, confidence = ?, injection = ?, junk = ? WHERE id = ?", v.topic, v.confidence, v.injection, v.junk, id);
    return this.get(id);
  }

  setStatus(id: string, status: FridgeStatus): StoredNote | null {
    this.ctx.storage.sql.exec("UPDATE notes SET status = ? WHERE id = ?", status, id);
    return this.get(id);
  }

  /** The newest approved notes, without anything private. */
  pinned(limit: number): FridgeNote[] {
    return this.ctx.storage.sql
      .exec<Row>("SELECT id, at, name, message, topic FROM notes WHERE status = 'approved' ORDER BY at DESC LIMIT ?", limit)
      .toArray()
      .map(({ id, at, name, message, topic }) => ({ id, at, name, message, topic: topic as FridgeTopic }));
  }
}
