/**
 * Runs the Rust/WASM Mancala engine off the main thread, so the UI stays smooth
 * even when the bot searches millions of positions.
 * The game rules live only in Rust; this file just passes boards in and out.
 */

interface Exports {
  memory: WebAssembly.Memory;
  state_ptr(): number;
  board_count(): number;
  load_board(i: number): void;
  apply_move(player: number, mv: number): number;
  game_over(): number;
  choose(player: number, timeMs: number): number;
  last_depth(): number;
  last_nodes(): number;
}

export type EngineRequest =
  | { id: number; op: "board"; index: number }
  | { id: number; op: "apply"; state: number[]; player: number; move: number }
  | { id: number; op: "choose"; state: number[]; player: number; timeMs: number };

export type EngineResponse =
  | { id: number; op: "board"; state: number[]; count: number }
  | { id: number; op: "apply"; state: number[]; next: number; over: boolean }
  | { id: number; op: "choose"; move: number; depth: number; nodes: number; ms: number }
  | { id: number; op: "error"; message: string };

const ready: Promise<Exports> = WebAssembly.instantiateStreaming(fetch("/wasm/mancala.wasm"), {}).then(
  (r) => r.instance.exports as unknown as Exports,
);

// Typed view of the worker global (the project compiles with DOM, not WebWorker, lib types).
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<EngineRequest>) => void) | null;
  postMessage(msg: EngineResponse): void;
};

const view = (ex: Exports) => new Int32Array(ex.memory.buffer, ex.state_ptr(), 14);

scope.onmessage = async (e: MessageEvent<EngineRequest>) => {
  const req = e.data;
  try {
    const ex = await ready;
    let res: EngineResponse;
    if (req.op === "board") {
      ex.load_board(req.index);
      res = { id: req.id, op: "board", state: [...view(ex)], count: ex.board_count() };
    } else if (req.op === "apply") {
      view(ex).set(req.state);
      const next = ex.apply_move(req.player, req.move);
      if (next < 0) throw new Error("Illegal move");
      res = { id: req.id, op: "apply", state: [...view(ex)], next, over: ex.game_over() === 1 };
    } else {
      view(ex).set(req.state);
      const t0 = performance.now();
      const move = ex.choose(req.player, req.timeMs);
      res = { id: req.id, op: "choose", move, depth: ex.last_depth(), nodes: ex.last_nodes(), ms: performance.now() - t0 };
    }
    scope.postMessage(res);
  } catch (err) {
    scope.postMessage({ id: req.id, op: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
