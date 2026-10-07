/**
 * The twin's face while you talk to him: his mouth moves while words stream into the chat (and
 * while his voice plays), he blinks now and then, and he glances at the chat while you type.
 *
 * The chat only fires DOM events ("twin:talk" per streamed chunk, "twin:speaking" around audio),
 * so it knows nothing about canvases. Whatever draws the face asks `face.frame(now)` and
 * `face.nextChange(now)` to know when to draw again.
 */

export type Mouth = 0 | 1 | 2; // closed, half open, open

/** How long after the last streamed chunk the mouth keeps moving. */
export const TALK_TAIL_MS = 250;
/** One mouth frame while talking. */
export const MOUTH_MS = 90;
const BLINK_MS = 130;
// Closed → half → open → half, so the mouth never snaps from shut to wide.
const CYCLE: Mouth[] = [0, 1, 2, 1];

/** The mouth frame at `now`: moving while text arrived recently or speech is playing, else closed. */
export function mouthFrame(lastTextAt: number, speaking: boolean, now: number): Mouth {
  if (!speaking && now - lastTextAt > TALK_TAIL_MS) return 0;
  return CYCLE[Math.floor(now / MOUTH_MS) % CYCLE.length]!;
}

export interface FaceFrame {
  mouth: Mouth;
  blink: boolean;
  /** Where he looks: -1 left, 0 at you, 1 right (toward the chat). */
  look: -1 | 0 | 1;
  talking: boolean;
}

class Face {
  private lastTextAt = -Infinity;
  private speaking = false;
  private nextBlink = 0;
  private blinkUntil = 0;
  private lookAt: FaceFrame["look"] = 0;
  private readonly listeners = new Set<() => void>();
  private readonly reducedMotion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  constructor() {
    if (typeof document === "undefined") return;
    document.addEventListener("twin:talk", () => this.update(() => (this.lastTextAt = performance.now())));
    document.addEventListener("twin:speaking", (e) => this.update(() => (this.speaking = !!(e as CustomEvent<{ on: boolean }>).detail?.on)));
    // He glances over at the chat while the visitor types, and back when they send.
    document.addEventListener("focusin", (e) => {
      if ((e.target as Element | null)?.closest?.("[data-chat] textarea")) this.update(() => (this.lookAt = 1));
    });
    document.addEventListener("focusout", (e) => {
      if ((e.target as Element | null)?.closest?.("[data-chat] textarea")) this.update(() => (this.lookAt = 0));
    });
  }

  get talking() {
    return this.speaking || performance.now() - this.lastTextAt <= TALK_TAIL_MS;
  }

  frame(now = performance.now()): FaceFrame {
    if (now >= this.nextBlink) {
      this.blinkUntil = now + BLINK_MS;
      this.nextBlink = now + 3000 + Math.random() * 2000;
    }
    const talking = this.speaking || now - this.lastTextAt <= TALK_TAIL_MS;
    // With reduced motion the mouth stays still; the chat shows a "speaking" indicator instead.
    const mouth = this.reducedMotion?.matches ? 0 : mouthFrame(this.lastTextAt, this.speaking, now);
    return { mouth, blink: now < this.blinkUntil, look: talking ? 0 : this.lookAt, talking };
  }

  /** Milliseconds until the face looks different, so idle faces cost one timer every few seconds. */
  nextChange(now = performance.now()) {
    if (this.talking && !this.reducedMotion?.matches) return MOUTH_MS - (now % MOUTH_MS);
    if (now < this.blinkUntil) return this.blinkUntil - now;
    return Math.max(16, this.nextBlink - now);
  }

  /** Called whenever something outside the clock changes the face (a chunk arrived, audio started). */
  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private update(change: () => void) {
    change();
    this.listeners.forEach((fn) => fn());
  }
}

export const face = new Face();
