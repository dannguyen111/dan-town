/**
 * The arcade robot's record against every visitor, from `/api/mancala` (see workers/api/src/mancala.ts).
 * Everything here fails soft: in `astro dev` there is no API, and the game works without it.
 */
import type { MancalaLevel, MancalaLevelRecord, MancalaRecord } from "@dan-town/api/types";

export type { MancalaLevel, MancalaRecord };

export async function fetchRecord(): Promise<MancalaRecord | null> {
  try {
    const res = await fetch("/api/mancala", { cache: "no-store" });
    return res.ok ? ((await res.json()) as MancalaRecord) : null;
  } catch {
    return null;
  }
}

/** Report a finished game. Resolves to the updated record, or null if it couldn't be saved. */
export async function reportResult(level: MancalaLevel, robot: number, human: number): Promise<MancalaRecord | null> {
  try {
    const res = await fetch("/api/mancala", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, robot, human }),
    });
    return res.ok ? ((await res.json()) as MancalaRecord) : null;
  } catch {
    return null;
  }
}

/** "16-1-0": the robot's wins, losses and draws. */
export const wld = (r: MancalaLevelRecord) => `${r.won}-${r.lost}-${r.draw}`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : word.endsWith("s") ? "es" : "s"}`;

/** "16 wins, 1 loss, 0 draws" */
export const describeRecord = (r: MancalaLevelRecord) => `${plural(r.won, "win")}, ${plural(r.lost, "loss")}, ${plural(r.draw, "draw")}`;

export const LEVEL_NAMES: Record<MancalaLevel, string> = { easy: "EASY", medium: "MEDIUM", hard: "HARD" };
