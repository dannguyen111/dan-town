/**
 * The Durable Object holding meeting requests. Logic and validation live in booking.ts.
 *
 * Personal details (name, email, topic) are kept only as long as needed: they're wiped when Dan
 * declines, when a request expires unanswered, and 30 days after the meeting. A daily alarm does
 * the sweeping. IPs are never stored, only a keyed hash for the per-visitor cap.
 */
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.ts";

export type BookingStatus = "pending" | "approving" | "approved" | "declined" | "expired";

export interface Booking {
  id: string;
  createdAt: number;
  ipHash: string;
  start: number;
  end: number;
  duration: number;
  /** The visitor's time zone, for the emails. */
  tz: string;
  /** "core" (9–5 ET) or "custom" (a time the visitor proposed outside that). */
  kind: "core" | "custom";
  name: string;
  email: string;
  topic: string;
  status: BookingStatus;
  eventLink: string;
}

type Row = {
  id: string;
  created_at: number;
  ip_hash: string;
  start_ms: number;
  end_ms: number;
  duration: number;
  tz: string;
  kind: string;
  name: string;
  email: string;
  topic: string;
  status: string;
  event_link: string;
};

const toBooking = (r: Row): Booking => ({
  id: r.id,
  createdAt: r.created_at,
  ipHash: r.ip_hash,
  start: r.start_ms,
  end: r.end_ms,
  duration: r.duration,
  tz: r.tz,
  kind: r.kind as Booking["kind"],
  name: r.name,
  email: r.email,
  topic: r.topic,
  status: r.status as BookingStatus,
  eventLink: r.event_link,
});

const DAY = 86_400_000;
export const KEEP_AFTER_MEETING = 30 * DAY;

export type AddResult = { ok: true; booking: Booking } | { ok: false; reason: "visitor_cap" | "daily_cap" | "taken" };

export class BookingStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      ip_hash TEXT NOT NULL,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      tz TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      topic TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      event_link TEXT NOT NULL DEFAULT ''
    )`);
    ctx.storage.sql.exec("CREATE INDEX IF NOT EXISTS bookings_created ON bookings (created_at)");
  }

  /**
   * Saves a pending request unless this visitor already sent `perVisitor` in the last 24 hours,
   * the site got `perDay`, or someone already holds (or was given) an overlapping time.
   */
  async add(b: Omit<Booking, "status" | "eventLink">, caps: { perVisitor: number; perDay: number }): Promise<AddResult> {
    const sql = this.ctx.storage.sql;
    const since = b.createdAt - DAY;
    const count = (q: string, ...args: unknown[]) => sql.exec<{ n: number }>(q, ...args).one().n;
    if (count("SELECT COUNT(*) AS n FROM bookings WHERE ip_hash = ? AND created_at > ?", b.ipHash, since) >= caps.perVisitor) return { ok: false, reason: "visitor_cap" };
    if (count("SELECT COUNT(*) AS n FROM bookings WHERE created_at > ?", since) >= caps.perDay) return { ok: false, reason: "daily_cap" };
    if (count("SELECT COUNT(*) AS n FROM bookings WHERE status IN ('pending','approving','approved') AND start_ms < ? AND end_ms > ?", b.end, b.start) > 0) {
      return { ok: false, reason: "taken" };
    }
    sql.exec(
      "INSERT INTO bookings (id, created_at, ip_hash, start_ms, end_ms, duration, tz, kind, name, email, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      b.id,
      b.createdAt,
      b.ipHash,
      b.start,
      b.end,
      b.duration,
      b.tz,
      b.kind,
      b.name,
      b.email,
      b.topic,
    );
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + DAY);
    return { ok: true, booking: this.get(b.id)! };
  }

  get(id: string): Booking | null {
    const row = this.ctx.storage.sql.exec<Row>("SELECT * FROM bookings WHERE id = ?", id).toArray()[0];
    return row ? toBooking(row) : null;
  }

  /** Moves pending → approving, atomically, so two clicks on Approve can't create two events. */
  claim(id: string): Booking | null {
    const cur = this.ctx.storage.sql.exec("UPDATE bookings SET status = 'approving' WHERE id = ? AND status = 'pending'", id);
    return cur.rowsWritten ? this.get(id) : null;
  }

  /** Puts a claimed request back to pending (when creating the event failed). */
  release(id: string) {
    this.ctx.storage.sql.exec("UPDATE bookings SET status = 'pending' WHERE id = ? AND status = 'approving'", id);
  }

  approve(id: string, eventLink: string): Booking | null {
    this.ctx.storage.sql.exec("UPDATE bookings SET status = 'approved', event_link = ? WHERE id = ?", eventLink, id);
    return this.get(id);
  }

  /** Declines a pending request and forgets who asked. */
  decline(id: string): boolean {
    const cur = this.ctx.storage.sql.exec("UPDATE bookings SET status = 'declined', name = '', email = '', topic = '' WHERE id = ? AND status = 'pending'", id);
    return cur.rowsWritten > 0;
  }

  /** Daily: expire unanswered requests whose time has passed and wipe personal details that aren't needed any more. */
  async alarm() {
    const now = Date.now();
    const sql = this.ctx.storage.sql;
    sql.exec("UPDATE bookings SET status = 'expired' WHERE status IN ('pending','approving') AND start_ms < ?", now);
    sql.exec("UPDATE bookings SET name = '', email = '', topic = '' WHERE status IN ('declined','expired') OR end_ms < ?", now - KEEP_AFTER_MEETING);
    sql.exec("DELETE FROM bookings WHERE created_at < ?", now - 90 * DAY);
    const { n } = sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM bookings").one();
    if (n > 0) await this.ctx.storage.setAlarm(now + DAY);
  }
}
