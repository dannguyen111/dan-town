/**
 * The twin's voice in the browser: cut the streaming reply into sentences, turn each into audio
 * via /api/twin/speak, and play them strictly in order while the rest of the reply is still
 * arriving. Pure pieces (cleanForSpeech, SentenceChunker) are unit-tested; SpeechQueue takes its
 * fetch and playback functions as arguments so it can be tested without a DOM.
 */

/** Turns light Markdown into something worth saying out loud: no URLs, asterisks, bullets or emoji. */
export function cleanForSpeech(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [label](url) -> label
    .replace(/(?:https?:\/\/|mailto:)\S+/g, "") // bare links
    .replace(/[*_`#>]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words ending in "." that don't end a sentence. */
const ABBREVIATIONS = /(?:\b(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|jr|sr|st|approx|incl)|\b[A-Z])\.$/i;
const MIN = 24;
const MAX = 300;

/**
 * Collects streamed text and hands back whole sentences. Very short sentences are held and joined
 * with the next one (fewer, smoother audio clips); runaway sentences are cut at MAX characters.
 */
export class SentenceChunker {
  private buffer = "";

  push(delta: string): string[] {
    this.buffer += delta;
    const out: string[] = [];
    for (;;) {
      const cut = this.boundary();
      if (cut < 0) break;
      out.push(this.buffer.slice(0, cut));
      this.buffer = this.buffer.slice(cut);
    }
    return out.map(cleanForSpeech).filter(Boolean);
  }

  /** Whatever is left once the reply has finished. */
  flush(): string[] {
    const rest = cleanForSpeech(this.buffer);
    this.buffer = "";
    return rest ? [rest] : [];
  }

  /** Index just past the next sentence end, or -1 when the buffer doesn't hold a whole sentence yet. */
  private boundary(): number {
    const b = this.buffer;
    // Sentence ends: . ! ? … (plus closing quotes/brackets) followed by whitespace, or a line break.
    const re = /([.!?…]+["')\]]*)(\s)|\n+/g;
    for (let m = re.exec(b); m; m = re.exec(b)) {
      const end = m.index + (m[1] ? m[1].length : m[0].length);
      if (m[1] && m[1].endsWith(".") && ABBREVIATIONS.test(b.slice(0, end))) continue;
      if (cleanForSpeech(b.slice(0, end)).length < MIN) continue;
      return end;
    }
    if (b.length > MAX) {
      const soft = Math.max(b.lastIndexOf(", ", MAX), b.lastIndexOf(" ", MAX));
      return soft > MIN ? soft + 1 : MAX;
    }
    return -1;
  }
}

export interface SpeechQueueDeps {
  /** Turns one sentence into playable audio. Should honour the abort signal. */
  fetchAudio: (text: string, signal: AbortSignal) => Promise<Blob>;
  /** Plays one clip and resolves when it ends (or is stopped). */
  play: (audio: Blob, signal: AbortSignal) => Promise<void>;
  /** At most this many sentences are synthesized ahead of playback. */
  concurrency?: number;
  onError?: (err: unknown) => void;
}

interface Item {
  text: string;
  audio?: Promise<Blob>;
}

/** Synthesizes sentences a couple at a time and plays them in the order they were added. */
export class SpeechQueue {
  private items: Item[] = [];
  private controller = new AbortController();
  private playing = false;

  constructor(private readonly deps: SpeechQueueDeps) {}

  add(text: string) {
    this.items.push({ text });
    this.prefetch();
    void this.drain();
  }

  /** Silences everything: aborts in-flight requests, drops queued sentences, stops the current clip. */
  stop() {
    this.controller.abort();
    this.controller = new AbortController();
    this.items = [];
    this.playing = false;
  }

  private prefetch() {
    const limit = this.deps.concurrency ?? 2;
    const signal = this.controller.signal;
    for (const item of this.items.slice(0, limit)) {
      if (!item.audio) {
        item.audio = this.deps.fetchAudio(item.text, signal);
        item.audio.catch(() => {}); // surfaced in drain()
      }
    }
  }

  private async drain() {
    if (this.playing) return;
    this.playing = true;
    const signal = this.controller.signal;
    try {
      while (this.items.length && !signal.aborted) {
        const item = this.items[0]!;
        this.prefetch();
        try {
          const audio = await item.audio!;
          if (signal.aborted) return;
          this.items.shift();
          this.prefetch();
          await this.deps.play(audio, signal);
        } catch (err) {
          if (signal.aborted) return;
          this.items.shift(); // skip the sentence that failed, keep talking
          this.deps.onError?.(err);
        }
      }
    } finally {
      if (!signal.aborted) this.playing = false;
    }
  }
}

/** One shared <audio> element: iOS unlocks playback per element, so the unlock and the queue must share it. */
let shared: HTMLAudioElement | null = null;
const audioEl = () => (shared ??= new Audio());

/** The browser wiring: POST to /api/twin/speak, play through the shared <audio> element. */
export function browserSpeechQueue(onError?: (err: unknown) => void): SpeechQueue {
  const el = audioEl();
  return new SpeechQueue({
    onError,
    fetchAudio: async (text, signal) => {
      const res = await fetch("/api/twin/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "speech failed");
      }
      return res.blob();
    },
    play: (audio, signal) =>
      new Promise<void>((resolve) => {
        const url = URL.createObjectURL(audio);
        const done = () => {
          el.onended = el.onerror = null;
          signal.removeEventListener("abort", stop);
          URL.revokeObjectURL(url);
          resolve();
        };
        const stop = () => {
          el.pause();
          done();
        };
        signal.addEventListener("abort", stop, { once: true });
        el.onended = done;
        el.onerror = done;
        el.src = url;
        el.play().catch(done); // autoplay refused: skip quietly
      }),
  });
}

/** Browsers only let a page start audio after a user gesture. Call this from the toggle's click. */
export function unlockAudio() {
  try {
    const el = audioEl();
    // A tiny silent WAV.
    el.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    void el.play().catch(() => {});
  } catch {
    /* no audio support */
  }
}

const PREF = "twin-voice";
export function readVoicePref(): boolean {
  try {
    return localStorage.getItem(PREF) === "on";
  } catch {
    return false;
  }
}
export function writeVoicePref(on: boolean) {
  try {
    localStorage.setItem(PREF, on ? "on" : "off");
  } catch {
    /* private mode */
  }
}
