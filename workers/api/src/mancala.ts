/**
 * The arcade robot's win/loss record against every visitor, per difficulty.
 *
 * Counts live in one SQLite-backed Durable Object, so simultaneous games never lose an update.
 * Results are reported by the visitor's browser, so the endpoint checks that each one is a
 * plausible final score and is rate-limited per IP. It's a fun scoreboard, not a ledger.
 */
import type { Env } from "./env.ts";
import type { MancalaLevel, MancalaRecord, MancalaResult } from "./types.ts";
import { HttpError } from "./twin.ts";

export const MANCALA_LEVELS: readonly MancalaLevel[] = ["easy", "medium", "hard"];
/** Every Kalah and FairKalah board the arcade offers has 48 stones; at the end they're all in the stores. */
const STONES = 48;

export function parseMancalaResult(body: unknown): MancalaResult {
  if (!body || typeof body !== "object") throw new HttpError(400, "Expected a JSON body.");
  const { level, robot, human } = body as Record<string, unknown>;
  if (!MANCALA_LEVELS.includes(level as MancalaLevel)) throw new HttpError(400, "Unknown level.");
  const score = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= STONES;
  if (!score(robot) || !score(human) || (robot as number) + (human as number) !== STONES) {
    throw new HttpError(400, `A finished game has all ${STONES} stones in the stores.`);
  }
  return { level: level as MancalaLevel, robot: robot as number, human: human as number };
}

/** Which column a result counts toward, from the robot's side. */
export const outcomeColumn = (r: MancalaResult) => (r.robot > r.human ? "won" : r.robot < r.human ? "lost" : "draw");

export const emptyRecord = (): MancalaRecord => ({
  easy: { played: 0, won: 0, lost: 0, draw: 0 },
  medium: { played: 0, won: 0, lost: 0, draw: 0 },
  hard: { played: 0, won: 0, lost: 0, draw: 0 },
});

const store = (env: Env) => env.MANCALA.get(env.MANCALA.idFromName("record"));

export const readMancalaRecord = (env: Env) => store(env).read();

export async function handleMancalaResult(request: Request, env: Env): Promise<MancalaRecord> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "anon";
  const { success } = await env.MANCALA_LIMITER.limit({ key: ip });
  if (!success) throw new HttpError(429, "Too many games reported. Take a breather!");
  const result = parseMancalaResult(await request.json().catch(() => null));
  return store(env).add(result);
}
