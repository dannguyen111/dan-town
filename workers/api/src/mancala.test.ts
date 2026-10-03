import { describe, expect, it, vi } from "vitest";

vi.mock("./generated/twin-context.ts", () => ({ TWIN_NAME: "Test", TWIN_VOICE: "", TWIN_CONTEXT: "", INTEGRATIONS: {} }));

const { HttpError } = await import("./twin.ts");
const { outcomeColumn, parseMancalaResult } = await import("./mancala.ts");

describe("parseMancalaResult", () => {
  it("accepts a finished game", () => {
    expect(parseMancalaResult({ level: "hard", robot: 30, human: 18 })).toEqual({ level: "hard", robot: 30, human: 18 });
  });

  it.each([
    [null],
    [{ level: "impossible", robot: 30, human: 18 }],
    [{ level: "easy", robot: 30, human: 17 }], // stones missing
    [{ level: "easy", robot: 49, human: -1 }],
    [{ level: "easy", robot: 24.5, human: 23.5 }],
    [{ level: "easy", robot: "30", human: "18" }],
  ])("rejects implausible results %#", (body) => {
    expect(() => parseMancalaResult(body)).toThrow(HttpError);
  });
});

describe("outcomeColumn", () => {
  it("scores from the robot's side", () => {
    expect(outcomeColumn({ level: "easy", robot: 30, human: 18 })).toBe("won");
    expect(outcomeColumn({ level: "easy", robot: 18, human: 30 })).toBe("lost");
    expect(outcomeColumn({ level: "easy", robot: 24, human: 24 })).toBe("draw");
  });
});
