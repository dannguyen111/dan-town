/**
 * The arcade's robot opponent: how it feels about its chances, what it says, and its pixel-art
 * portrait. Its mood comes straight from the engine's own alpha-beta score.
 */

export type Mood = "idle" | "thinking" | "gloat" | "happy" | "neutral" | "worried" | "panic" | "won" | "lost" | "draw";

/**
 * The search score is the regression heuristic from MAX's side, roughly "stones ahead"
 * (score difference dominates its weights). A logistic squash turns it into a win chance:
 * 5 stones up reads as about 73%, 10 up as about 88%.
 */
export const winChance = (value: number, robotSide: number) => 1 / (1 + Math.exp(-(robotSide === 0 ? value : -value) / 5));

export const moodFor = (p: number): Mood => (p >= 0.88 ? "gloat" : p >= 0.65 ? "happy" : p >= 0.35 ? "neutral" : p >= 0.12 ? "worried" : "panic");

export const LINES: Partial<Record<Mood, string[]>> = {
  gloat: ["This is going exactly as calculated.", "I can see the ending from here.", "Would you like me to go easy on you? Too late.", "My heuristic is purring."],
  happy: ["Ooh, I like how this looks.", "Nice board. Mostly mine, though.", "Things are trending my way.", "Bleep bloop. Feeling good."],
  neutral: ["Hmm. Even game so far.", "Interesting. Very interesting.", "You're not bad at this.", "Still anyone's game."],
  worried: ["Wait, that wasn't in my search tree...", "Recalculating. Recalculating.", "Okay, okay. I can still fix this.", "My fans are spinning up."],
  panic: ["ERROR: winning line not found.", "Who taught you to play like this?!", "This is fine. Everything is fine.", "Mayday! Mayday!"],
  won: ["GG! Better luck next time, human.", "VICTORY.EXE completed successfully.", "Another one for the training data."],
  lost: ["You beat me. I'm telling my programmer.", "Well played. I need to retune my weights.", "I... I demand a rematch."],
  draw: ["A draw? I'll call that a moral victory.", "Perfectly balanced, as all things should be."],
};

export const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]!;

// ───────────────────────────── pixel portrait ─────────────────────────────

const INK = "#1b1530";
const METAL = "#d5dde8";
const METAL_LIGHT = "#f2f6fa";
const METAL_DARK = "#9aa8b8";
const SCREEN = "#14202c";
const TEAR = "#8fd3ff";

/** Face glyphs on the robot's 16×10 screen: "#" is the face colour, "t" a tear or sweat drop. */
const FACES: Record<Mood, { color: string; bulb: string; rows: string[] }> = {
  idle: {
    color: "#7df9ff",
    bulb: "#7df9ff",
    rows: ["................", "................", "...##......##...", "...##......##...", "................", "................", "....#......#....", ".....######.....", "................", "................"],
  },
  thinking: {
    color: "#7df9ff",
    bulb: "#ffd166",
    rows: ["....##......##..", "....##......##..", "................", "................", "................", "................", "................", ".......###......", "................", "..........#.#.#."],
  },
  gloat: {
    color: "#7dffb0",
    bulb: "#7dffb0",
    rows: ["..##........##..", "................", "...##......##...", "..#..#....#..#..", "................", "...##########...", "...#........#...", "....#......#....", ".....######.....", "................"],
  },
  happy: {
    color: "#7dffb0",
    bulb: "#7dffb0",
    rows: ["................", "................", "...##......##...", "..#..#....#..#..", "................", "................", "....#......#....", ".....######.....", "................", "................"],
  },
  neutral: {
    color: "#7df9ff",
    bulb: "#ffd166",
    rows: ["................", "................", "...##......##...", "...##......##...", "................", "................", "................", ".....######.....", "................", "................"],
  },
  worried: {
    color: "#ffd166",
    bulb: "#ffb347",
    rows: ["....##....##....", "..##........##..", "................", "...###....###...", "...###....###...", "................", "................", "....##.##.##....", "...#..#..#..#...", "................"],
  },
  panic: {
    color: "#ff8a80",
    bulb: "#ff5c5c",
    rows: ["..####....####.t", "..#..#....#..#tt", "..#.##....##.#tt", "..####....####..", "................", "......####......", ".....#....#.....", ".....#....#.....", "......####......", "................"],
  },
  won: {
    color: "#7dffb0",
    bulb: "#7dffb0",
    rows: ["................", "...#........#...", "..###......###..", "...#........#...", "................", "..############..", "..#..........#..", "...#........#...", "....########....", "................"],
  },
  lost: {
    color: "#ff8a80",
    bulb: "#ff5c5c",
    rows: ["................", "..#..#....#..#..", "...##......##...", "...##......##...", "..#..#....#..#..", "..t.............", "..t.............", ".....######.....", "....#......#....", "...#........#..."],
  },
  draw: {
    color: "#7df9ff",
    bulb: "#ffd166",
    rows: ["................", "................", "...##......##...", "...##......##...", "................", "................", "................", "....##..##..##..", "...#..##..##....", "................"],
  },
};

/** Canvas size of the portrait, in art pixels. CSS scales it up with crisp edges. */
export const ROBOT_W = 40;
export const ROBOT_H = 36;

/** Draws the robot portrait for a mood. The antenna bulb blinks while it thinks. */
export function drawRobot(ctx: CanvasRenderingContext2D, mood: Mood, bulbOn = true) {
  const r = (c: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const face = FACES[mood];
  ctx.clearRect(0, 0, ROBOT_W, ROBOT_H);
  // Antenna
  r(INK, 19, 3, 2, 6);
  r(INK, 17, 0, 6, 4);
  r(bulbOn ? face.bulb : "#4b4f5c", 18, 1, 4, 2);
  // Ears
  r(INK, 3, 13, 4, 9);
  r(METAL_DARK, 4, 14, 2, 7);
  r(INK, 33, 13, 4, 9);
  r(METAL_DARK, 34, 14, 2, 7);
  // Head, with a highlight and a shaded side
  r(INK, 7, 8, 26, 20);
  r(INK, 6, 9, 28, 18);
  r(METAL, 7, 9, 26, 18);
  r(METAL_LIGHT, 8, 9, 24, 1);
  r(METAL_DARK, 31, 10, 2, 16);
  // Screen and face
  r(INK, 10, 11, 20, 14);
  r(SCREEN, 11, 12, 18, 12);
  face.rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "#") r(face.color, 12 + x, 13 + y, 1, 1);
      else if (c === "t") r(TEAR, 12 + x, 13 + y, 1, 1);
    }),
  );
  // Neck and shoulders
  r(INK, 16, 28, 8, 2);
  r(INK, 8, 30, 24, 6);
  r(METAL, 9, 31, 22, 5);
  r(METAL_LIGHT, 9, 31, 22, 1);
  r("#ff7a59", 14, 33, 2, 2);
  r("#ffd166", 19, 33, 2, 2);
  r("#59f0d0", 24, 33, 2, 2);
}
