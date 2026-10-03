/** The Durable Object holding the arcade robot's record. Logic and validation live in mancala.ts. */
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env.ts";
import type { MancalaLevel, MancalaRecord, MancalaResult } from "./types.ts";
import { MANCALA_LEVELS, emptyRecord, outcomeColumn } from "./mancala.ts";

export class MancalaRecordStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS record (level TEXT PRIMARY KEY, won INTEGER NOT NULL DEFAULT 0, lost INTEGER NOT NULL DEFAULT 0, draw INTEGER NOT NULL DEFAULT 0)",
    );
  }

  read(): MancalaRecord {
    const record = emptyRecord();
    for (const row of this.ctx.storage.sql.exec<{ level: string; won: number; lost: number; draw: number }>("SELECT * FROM record")) {
      if (!MANCALA_LEVELS.includes(row.level as MancalaLevel)) continue;
      const { won, lost, draw } = row;
      record[row.level as MancalaLevel] = { played: won + lost + draw, won, lost, draw };
    }
    return record;
  }

  add(result: MancalaResult): MancalaRecord {
    // The column name comes from a fixed set, never from the request.
    const col = outcomeColumn(result);
    this.ctx.storage.sql.exec(`INSERT INTO record (level, ${col}) VALUES (?, 1) ON CONFLICT(level) DO UPDATE SET ${col} = ${col} + 1`, result.level);
    return this.read();
  }
}
