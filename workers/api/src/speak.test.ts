import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env.ts";

vi.mock("./generated/twin-context.ts", () => ({
  TWIN_NAME: "Test Person",
  TWIN_VOICE: "Friendly.",
  TWIN_CONTEXT: "# Test Person",
  INTEGRATIONS: { github: { username: null }, leetcode: { username: null }, spotify: { enabled: false } },
}));

const { handleSpeak, parseSpeakRequest, SPEAK_LIMITS } = await import("./speak.ts");
const { HttpError } = await import("./twin.ts");

afterEach(() => vi.unstubAllGlobals());

const env = (over: Partial<Env> = {}) =>
  ({
    OPENROUTER_API_KEY: "sk-or-k",
    TTS_MODEL: "hexgrad/kokoro-82m",
    TTS_VOICE: "am_michael",
    SITE_URL: "https://si-dan.com",
    SPEAK_LIMITER: { limit: async () => ({ success: true }) },
    ...over,
  }) as unknown as Env;

const post = (body: unknown) =>
  new Request("https://si-dan.com/api/twin/speak", { method: "POST", body: JSON.stringify(body), headers: { "CF-Connecting-IP": "1.2.3.4" } });

const status = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof HttpError ? e.status : -1;
  }
  return 200;
};

describe("parseSpeakRequest", () => {
  it("cleans control characters and trims", () => {
    expect(parseSpeakRequest({ text: "  Hi\u0007 there.  " })).toBe("Hi there.");
  });

  it.each([
    [null, 400],
    [{ text: 5 }, 400],
    [{ text: "   " }, 400],
    [{ text: "x".repeat(SPEAK_LIMITS.chars + 1) }, 413],
  ])("rejects %j with %i", async (body, code) => {
    expect(await status((async () => parseSpeakRequest(body))())).toBe(code);
  });
});

describe("handleSpeak", () => {
  it("asks OpenRouter for MP3 in the configured voice and streams it back", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await handleSpeak(post({ text: "Hello there." }), env());
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/audio/speech");
    expect(init.headers.Authorization).toBe("Bearer sk-or-k");
    expect(JSON.parse(init.body)).toEqual({ model: "hexgrad/kokoro-82m", voice: "am_michael", input: "Hello there.", response_format: "mp3", provider: { zdr: true } });
  });

  it("retries once when the provider is busy", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(new Response(new Uint8Array([9])));
    vi.stubGlobal("fetch", fetchMock);
    await handleSpeak(post({ text: "Hi." }), env());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is off without a model, rate-limited, and maps upstream failures to 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
    expect(await status(handleSpeak(post({ text: "Hi." }), env({ TTS_MODEL: "" })))).toBe(503);
    expect(await status(handleSpeak(post({ text: "Hi." }), env({ SPEAK_LIMITER: { limit: async () => ({ success: false }) } as never })))).toBe(429);
    expect(await status(handleSpeak(post({ text: "Hi." }), env()))).toBe(502);
  });
});
