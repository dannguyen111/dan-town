import { describe, expect, it } from "vitest";
import { MOUTH_MS, TALK_TAIL_MS, mouthFrame } from "./face.ts";

// A time at the start of a mouth cycle (four frames).
const BASE = MOUTH_MS * 4 * 100;

describe("mouthFrame", () => {
  it("stays closed when nothing is being said", () => {
    expect(mouthFrame(-Infinity, false, BASE + MOUTH_MS * 2)).toBe(0);
    expect(mouthFrame(BASE, false, BASE + TALK_TAIL_MS + 1)).toBe(0);
  });

  it("cycles closed → half → open → half while text streams in", () => {
    const frames = [0, 1, 2].map((i) => mouthFrame(BASE + i * MOUTH_MS, false, BASE + i * MOUTH_MS));
    expect(frames).toEqual([0, 1, 2]);
    expect(mouthFrame(BASE + 3 * MOUTH_MS, false, BASE + 3 * MOUTH_MS)).toBe(1);
  });

  it("keeps moving while speech plays, long after the text stopped", () => {
    expect(mouthFrame(0, true, BASE + MOUTH_MS * 2)).toBe(2);
    expect(mouthFrame(0, false, BASE + MOUTH_MS * 2)).toBe(0);
  });
});
