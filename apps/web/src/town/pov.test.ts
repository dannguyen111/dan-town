import { describe, expect, it } from "vitest";
import { FRAME, PHONES_OFF, PHONES_OFF_STEPS, PHONES_ON, SCREENS, WEBCAM, nextPoseIn, phonesOffPose, povLayout, screenBox } from "./pov.ts";

describe("povLayout", () => {
  it("fits the frame at a whole-number scale and centres it", () => {
    const L = povLayout(720, 844, 1);
    expect(L.s).toBe(2);
    expect(L.W).toBe(360);
    expect(L.H).toBe(422);
    expect(L.ox).toBe(20);
    expect(L.oy).toBe(121);
  });

  it("never scales below 1, and uses device pixels", () => {
    expect(povLayout(200, 100, 1).s).toBe(1);
    expect(povLayout(375, 600, 3).s).toBe(3);
  });

  it("can focus on part of the frame (the webcam)", () => {
    const L = povLayout(288, 162, 2, WEBCAM);
    expect(L.s).toBe(2);
    // The focus box's centre lands on the canvas centre.
    expect((L.ox + WEBCAM.x + WEBCAM.w / 2) * L.s).toBeCloseTo((288 * 2) / 2, -1);
  });
});

describe("screenBox", () => {
  it("maps a screen in the art to CSS pixels over the canvas", () => {
    const L = povLayout(640, 360, 2);
    expect(L.s).toBe(4);
    expect(screenBox(L, SCREENS.tv)).toEqual({ left: 248, top: 100, width: 160, height: 90 });
  });

  it("keeps both screens 16:9 inside the frame", () => {
    for (const b of Object.values(SCREENS)) {
      expect(b.w / b.h).toBeCloseTo(16 / 9, 2);
      expect(b.x + b.w).toBeLessThanOrEqual(FRAME.w);
      expect(b.y + b.h).toBeLessThanOrEqual(FRAME.h);
    }
  });
});

describe("headphones off", () => {
  it("waits for the zoom, then goes hands up, lift, jaw, neck, hands down", () => {
    expect(phonesOffPose(0)).toBe(PHONES_ON);
    expect([600, 900, 1100, 1400].map((ms) => phonesOffPose(ms).phones)).toEqual(["head", "lifted", "jaw", "neck"]);
    expect(phonesOffPose(1400).hands).toBe(true);
    expect(phonesOffPose(60_000)).toBe(PHONES_OFF);
  });

  it("says when the next pose is due, and stops once they're off", () => {
    expect(nextPoseIn(0)).toBe(PHONES_OFF_STEPS[1]![0]);
    expect(nextPoseIn(900)).toBe(150);
    expect(nextPoseIn(1550)).toBeNull();
  });
});
