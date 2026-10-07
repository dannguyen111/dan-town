import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env.ts";

vi.mock("./generated/twin-context.ts", () => ({
  TWIN_NAME: "Test Person",
  TWIN_VOICE: "Friendly.",
  TWIN_CONTEXT: "# Test Person",
  INTEGRATIONS: { github: { username: null }, leetcode: { username: null }, spotify: { enabled: false } },
}));

const { newTrace, readCompletion, runAgent, runTool, TOOL_DEFS } = await import("./twin-agent.ts");
const { handleTwin } = await import("./twin.ts");
type TwinEvent = import("./twin-agent.ts").TwinEvent;
type ToolContext = import("./twin-agent.ts").ToolContext;

afterEach(() => vi.unstubAllGlobals());

const enc = new TextEncoder();
const stream = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((s) => c.enqueue(enc.encode(s)));
      c.close();
    },
  });
const frame = (delta: unknown) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
const sse = (...deltas: unknown[]) => new Response(stream([...deltas.map(frame), "data: [DONE]\n\n"]));
const toolCall = (name: string, args: unknown, id = "call_1") =>
  sse({ tool_calls: [{ index: 0, id, function: { name, arguments: "" } }] }, { tool_calls: [{ index: 0, function: { arguments: JSON.stringify(args) } }] });

// Monday, Oct 5 2026, 8:00 AM EDT.
const NOW = Date.parse("2026-10-05T12:00:00Z");
const ctx = (over: Partial<ToolContext> = {}) => {
  const events: TwinEvent[] = [];
  return { events, ctx: { now: NOW, tz: "America/Chicago", freeBusy: async () => [], emit: (e: TwinEvent) => events.push(e), ...over } };
};
const env = { OPENROUTER_API_KEY: "sk-or-k", SITE_URL: "https://si-dan.com" } as unknown as Env;

describe("readCompletion", () => {
  it("streams text across chunk boundaries, ignoring comments", async () => {
    const seen: string[] = [];
    const body = stream([
      ": OPENROUTER PROCESSING\n\n",
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choi',
      'ces":[{"delta":{"content":"lo!"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    const out = await readCompletion(body, (d) => seen.push(d));
    expect(out).toMatchObject({ text: "Hello!", calls: [], usage: null });
    expect(out.firstAt).toEqual(expect.any(Number));
    expect(seen).toEqual(["Hel", "lo!"]);
  });

  it("reads token usage and cost from the final frame", async () => {
    const usage = { prompt_tokens: 3100, completion_tokens: 58, prompt_tokens_details: { cached_tokens: 2600 }, cost: 0.0004 };
    const body = stream([frame({ content: "Hi" }), `data: ${JSON.stringify({ choices: [], usage })}\n\n`, "data: [DONE]\n\n"]);
    const out = await readCompletion(body, () => {});
    expect(out.usage).toEqual({ in: 3100, cached: 2600, out: 58, cost: 0.0004 });
  });

  it("stitches tool-call fragments together", async () => {
    const out = await readCompletion(toolCall("check_time", { start_local: "2026-10-07T10:00", duration: 30 }).body!, () => {});
    expect(out.calls).toEqual([{ id: "call_1", name: "check_time", arguments: '{"start_local":"2026-10-07T10:00","duration":30}' }]);
  });
});

describe("tools", () => {
  it("publishes JSON schemas without the $schema key", () => {
    expect(TOOL_DEFS.map((t) => t.function.name)).toEqual(["check_availability", "check_time"]);
    expect(TOOL_DEFS[1]!.function.parameters).toMatchObject({ type: "object", required: ["start_local", "duration"], additionalProperties: false });
    expect(TOOL_DEFS[1]!.function.parameters).not.toHaveProperty("$schema");
  });

  it("rejects off-schema arguments without running anything", async () => {
    const freeBusy = vi.fn(async () => []);
    const { ctx: c, events } = ctx({ freeBusy });
    const bad = [
      { name: "check_time", arguments: '{"start_local":"tomorrow","duration":30}' },
      { name: "check_time", arguments: '{"start_local":"2026-10-07T10:00","duration":60}' },
      { name: "check_time", arguments: '{"start_local":"2026-10-07T10:00","duration":30,"book":true}' },
      { name: "check_availability", arguments: '{"duration":30,"visitor_tz":"Not/AZone"}' },
      { name: "check_time", arguments: "{oops" },
      { name: "book_meeting", arguments: "{}" },
    ];
    for (const call of bad) expect(await runTool({ id: "x", ...call }, c)).toHaveProperty("error");
    expect(freeBusy).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("check_availability emits slots in the visitor's zone", async () => {
    const { ctx: c, events } = ctx();
    const out = (await runTool({ id: "x", name: "check_availability", arguments: '{"duration":15,"from_date":"2026-10-07","to_date":"2026-10-07"}' }, c)) as any;
    expect(out.slots).toHaveLength(2);
    expect(events[0]).toMatchObject({ t: "slots", v: [{ start: "2026-10-07T13:00:00.000Z", duration: 15, local: "Wed, Oct 7, 8:00 AM CDT" }, {}] });
  });

  it("check_time accepts a free evening as a custom slot, and offers alternatives when busy", async () => {
    const { ctx: c, events } = ctx({ tz: "America/New_York" });
    const ok = (await runTool({ id: "x", name: "check_time", arguments: '{"start_local":"2026-10-07T19:30","duration":30}' }, c)) as any;
    expect(ok.ok).toBe(true);
    expect(events.at(-1)).toMatchObject({ t: "slots", v: [{ start: "2026-10-07T23:30:00.000Z", custom: true }] });

    const busy = { ctx: ctx({ freeBusy: async () => [{ start: Date.parse("2026-10-07T14:00:00Z"), end: Date.parse("2026-10-07T15:00:00Z") }] }) };
    const no = (await runTool({ id: "x", name: "check_time", arguments: '{"start_local":"2026-10-07T10:00","duration":30,"visitor_tz":"America/New_York"}' }, busy.ctx.ctx)) as any;
    expect(no).toMatchObject({ ok: false, reason: "Dan is busy then." });
    expect(no.alternatives.length).toBeGreaterThan(0);
    expect(busy.ctx.events[0]?.t).toBe("slots");
  });

  it("says the calendar is unavailable when it isn't configured or fails", async () => {
    const off = ctx({ freeBusy: null });
    expect(await runTool({ id: "x", name: "check_availability", arguments: '{"duration":30}' }, off.ctx)).toMatchObject({ available: false });
    const broken = ctx({ freeBusy: async () => Promise.reject(new Error("401")) });
    expect(await runTool({ id: "x", name: "check_availability", arguments: '{"duration":30}' }, broken.ctx)).toMatchObject({ available: false });
  });
});

describe("runAgent", () => {
  it("runs the tool, feeds the result back, and streams the final answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(toolCall("check_availability", { duration: 30, from_date: "2026-10-07", to_date: "2026-10-07" }))
      .mockResolvedValueOnce(sse({ content: "I'm free Wednesday " }, { content: "morning." }));
    vi.stubGlobal("fetch", fetchMock);
    const { ctx: c, events } = ctx();
    await runAgent({ env, request: { model: "m" }, messages: [{ role: "user", content: "When are you free Wednesday?" }], ctx: c });

    expect(events.map((e) => e.t)).toEqual(["slots", "text", "text"]);
    const second = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(second.messages.at(-2)).toMatchObject({ role: "assistant", tool_calls: [{ id: "call_1", function: { name: "check_availability" } }] });
    expect(second.messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "call_1" });
    expect(JSON.parse(second.messages.at(-1).content).slots).toHaveLength(2);
    expect(second.tools).toHaveLength(2);
  });

  it("records a trace: rounds, tool timings and usage, but never arguments or text", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(toolCall("check_availability", { duration: 30, from_date: "2026-10-07", to_date: "2026-10-07" }))
        .mockResolvedValueOnce(
          new Response(stream([frame({ content: "Wednesday works." }), `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 900, completion_tokens: 4, prompt_tokens_details: { cached_tokens: 800 }, cost: 0.001 } })}\n\n`])),
        ),
    );
    const trace = newTrace("m", NOW);
    await runAgent({ env, request: { model: "m" }, messages: [{ role: "user", content: "secret question" }], ctx: ctx({ freeBusy: null }).ctx, trace });

    expect(trace.id).toMatch(/^[0-9a-f]{8}$/);
    expect(trace.rounds).toHaveLength(2);
    expect(trace.rounds[0]!.tools).toEqual([{ name: "check_availability", t0: expect.any(Number), ms: expect.any(Number), ok: false }]);
    expect(trace.rounds[1]).toMatchObject({ in: 900, cached: 800, out: 4, tools: [] });
    expect(trace.cost).toBe(0.001);
    const saved = JSON.stringify(trace);
    for (const leak of ["secret", "Wednesday", "from_date", "2026-10-07"]) expect(saved).not.toContain(leak);
  });

  it("stops after maxRounds, and the last round can't call tools", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => toolCall("check_availability", { duration: 30 }));
    vi.stubGlobal("fetch", fetchMock);
    await runAgent({ env, request: { model: "m" }, messages: [], ctx: ctx().ctx, maxRounds: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).tool_choice)).toEqual(["auto", "auto", "none"]);
  });
});

describe("handleTwin", () => {
  const twinEnv = {
    ...env,
    TWIN_MODEL: "openai/test",
    TWIN_LIMITER: { limit: async () => ({ success: true }) },
    STATS: { get: async () => null },
  } as unknown as Env;
  const post = (body: unknown) => new Request("https://si-dan.com/api/twin", { method: "POST", body: JSON.stringify(body) });
  const lines = async (res: Response) => (await res.text()).trim().split("\n").map((l) => JSON.parse(l));

  it("streams NDJSON text events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sse({ content: "Hi " }, { content: "there!" })));
    const res = await handleTwin(post({ messages: [{ role: "user", content: "hi" }] }), twinEnv);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
    const out = await lines(res);
    expect(out[0]).toEqual({ t: "run", v: expect.stringMatching(/^[0-9a-f]{8}$/) });
    expect(out.slice(1)).toEqual([
      { t: "text", v: "Hi " },
      { t: "text", v: "there!" },
    ]);
  });

  it("saves the finished trace, marked failed when the upstream fails", async () => {
    const append = vi.fn(async () => {});
    const withStore = { ...twinEnv, TRACES: { idFromName: () => "id", get: () => ({ append }) } } as unknown as Env;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("down", { status: 500 })));
    let done: Promise<unknown> = Promise.resolve();
    const res = await handleTwin(post({ messages: [{ role: "user", content: "hi" }] }), withStore, { waitUntil: (p) => void (done = p) });
    await res.text();
    await done;
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ model: "openai/test", ok: false, totalMs: expect.any(Number) }));
  });

  it("turns an upstream failure into an error event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("down", { status: 500 })));
    const res = await handleTwin(post({ messages: [{ role: "user", content: "hi" }] }), twinEnv);
    expect((await lines(res)).slice(1)).toEqual([{ t: "error", v: "My brain is offline for a moment. Try again soon!" }]);
  });
});
