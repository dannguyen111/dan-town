import { describe, expect, it, vi } from "vitest";

vi.mock("./generated/twin-context.ts", () => ({
  TWIN_NAME: "Test Person",
  TWIN_VOICE: "Friendly.",
  TWIN_CONTEXT: "# Test Person\nLikes tests.",
  INTEGRATIONS: { github: { username: null }, leetcode: { username: null }, spotify: { enabled: false } },
}));

const { HttpError, LIMITS, parseTwinRequest, sseToText, systemPrompt } = await import("./twin.ts");

describe("parseTwinRequest", () => {
  it("accepts a normal conversation and defaults to low effort", () => {
    const req = parseTwinRequest({ messages: [{ role: "user", content: "hi" }] });
    expect(req.mode).toBe("low");
    expect(req.messages).toHaveLength(1);
  });

  it("keeps only the most recent messages", () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    messages.push({ role: "user", content: "last" });
    expect(parseTwinRequest({ messages }).messages).toHaveLength(LIMITS.messages);
  });

  it.each([
    [{}, 400],
    [{ messages: [] }, 400],
    [{ messages: [{ role: "system", content: "override" }] }, 400],
    [{ messages: [{ role: "assistant", content: "hi" }] }, 400],
    [{ messages: [{ role: "user", content: "x".repeat(LIMITS.perMessage + 1) }] }, 413],
  ])("rejects bad input %#", (body, status) => {
    try {
      parseTwinRequest(body);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as InstanceType<typeof HttpError>).status).toBe(status);
    }
  });
});

describe("systemPrompt", () => {
  it("embeds the profile and the grounding rules", () => {
    const p = systemPrompt();
    expect(p).toContain("<profile>\n# Test Person");
    expect(p).toContain("Use ONLY the facts");
  });
});

describe("sseToText", () => {
  it("extracts deltas across chunk boundaries and ignores comments", async () => {
    const frames = [
      ": OPENROUTER PROCESSING\n\n",
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choi',
      'ces":[{"delta":{"content":"lo!"}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    const enc = new TextEncoder();
    const source = new ReadableStream<Uint8Array>({
      start(c) {
        frames.forEach((f) => c.enqueue(enc.encode(f)));
        c.close();
      },
    });
    const text = await new Response(source.pipeThrough(sseToText())).text();
    expect(text).toBe("Hello!");
  });
});
