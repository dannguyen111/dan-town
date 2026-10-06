import { describe, expect, it, vi } from "vitest";
import { cleanForSpeech, SentenceChunker, SpeechQueue } from "./speech.ts";

describe("cleanForSpeech", () => {
  it("drops markdown, links, bullets and emoji", () => {
    expect(cleanForSpeech("Hey! 👋 I'm **Dan**.")).toBe("Hey! I'm Dan.");
    expect(cleanForSpeech("See [my GitHub](https://github.com/x) or https://si-dan.com/dev now")).toBe("See my GitHub or now");
    expect(cleanForSpeech("- one\n- two")).toBe("one two");
  });
});

const feed = (chunks: string[]) => {
  const c = new SentenceChunker();
  return [...chunks.flatMap((d) => c.push(d)), ...c.flush()];
};

describe("SentenceChunker", () => {
  it("emits sentences as soon as they're complete, across chunk boundaries", () => {
    const c = new SentenceChunker();
    expect(c.push("I mostly build web apps with Type")).toEqual([]);
    expect(c.push("Script and Rust. Lately I've been")).toEqual(["I mostly build web apps with TypeScript and Rust."]);
    expect(c.flush()).toEqual(["Lately I've been"]);
  });

  it("doesn't split abbreviations or decimals", () => {
    expect(feed(["I like systems work, e.g. compilers and runtimes. My GPA was 3.9 last term. Thanks for asking!"])).toEqual([
      "I like systems work, e.g. compilers and runtimes.",
      "My GPA was 3.9 last term.",
      "Thanks for asking!", // the tail, flushed when the reply ends
    ]);
  });

  it("joins very short sentences with the next one", () => {
    expect(feed(["Hi! Yes. I'd be glad to tell you about the arcade bot."])).toEqual(["Hi! Yes. I'd be glad to tell you about the arcade bot."]);
  });

  it("splits on line breaks (bullets) and cuts runaway text", () => {
    expect(feed(["- Built the Mancala engine in Rust\n- Wrote the town renderer in TypeScript\n"])).toEqual([
      "Built the Mancala engine in Rust",
      "Wrote the town renderer in TypeScript",
    ]);
    const long = feed(["word ".repeat(120)]);
    expect(long.length).toBeGreaterThan(1);
    expect(Math.max(...long.map((s) => s.length))).toBeLessThanOrEqual(300);
  });
});

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("SpeechQueue", () => {
  it("plays in the order sentences were added, even when audio arrives out of order", async () => {
    const played: string[] = [];
    const resolvers: Record<string, (b: Blob) => void> = {};
    const q = new SpeechQueue({
      concurrency: 2,
      fetchAudio: (text) => new Promise((r) => (resolvers[text] = r)),
      play: async (audio) => void played.push(await audio.text()),
    });
    q.add("one");
    q.add("two");
    q.add("three");
    await tick();
    expect(Object.keys(resolvers)).toEqual(["one", "two"]); // only two synthesized ahead
    resolvers.two!(new Blob(["two"]));
    await tick();
    expect(played).toEqual([]);
    resolvers.one!(new Blob(["one"]));
    await tick();
    await tick();
    expect(Object.keys(resolvers)).toContain("three");
    resolvers.three!(new Blob(["three"]));
    await tick();
    await tick();
    expect(played).toEqual(["one", "two", "three"]);
  });

  it("skips a sentence that fails and keeps going", async () => {
    const played: string[] = [];
    const onError = vi.fn();
    const q = new SpeechQueue({
      onError,
      fetchAudio: async (text) => {
        if (text === "bad") throw new Error("nope");
        return new Blob([text]);
      },
      play: async (audio) => void played.push(await audio.text()),
    });
    q.add("bad");
    q.add("good");
    for (let i = 0; i < 5; i++) await tick();
    expect(played).toEqual(["good"]);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("stop() aborts requests and drops the queue", async () => {
    const signals: AbortSignal[] = [];
    const play = vi.fn(async () => {});
    const q = new SpeechQueue({
      fetchAudio: (_t, signal) => {
        signals.push(signal);
        return new Promise(() => {});
      },
      play,
    });
    q.add("one");
    q.add("two");
    q.stop();
    expect(signals.every((s) => s.aborted)).toBe(true);
    await tick();
    expect(play).not.toHaveBeenCalled();
  });
});
