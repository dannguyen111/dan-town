import type { EngineRequest, EngineResponse } from "./engine.worker.ts";

type Op<T extends EngineResponse["op"]> = Extract<EngineResponse, { op: T }>;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** Promise wrapper around the engine worker. The worker is created lazily on first use. */
export class MancalaEngine {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, (r: EngineResponse) => void>();

  private get w() {
    if (!this.worker) {
      this.worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<EngineResponse>) => {
        this.pending.get(e.data.id)?.(e.data);
        this.pending.delete(e.data.id);
      };
    }
    return this.worker;
  }

  private call<T extends EngineResponse["op"]>(req: DistributiveOmit<EngineRequest, "id">): Promise<Op<T>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (r) => (r.op === "error" ? reject(new Error(r.message)) : resolve(r as Op<T>)));
      this.w.postMessage({ ...req, id });
    });
  }

  board(index: number) {
    return this.call<"board">({ op: "board", index });
  }
  apply(state: number[], player: number, move: number) {
    return this.call<"apply">({ op: "apply", state, player, move });
  }
  choose(state: number[], player: number, timeMs: number) {
    return this.call<"choose">({ op: "choose", state, player, timeMs });
  }

  /** Abort a long search (e.g. "New game" while the bot is thinking on Hard). */
  reset() {
    this.worker?.terminate();
    this.worker = null;
    for (const resolve of this.pending.values()) resolve({ id: -1, op: "error", message: "cancelled" });
    this.pending.clear();
  }
}
