/**
 * The town layout. Pure data, with no DOM and no profile access, so it is easy to test.
 *
 * Ground legend:  T tree (solid) · . grass · , flowers · = path/paving · ~ water (solid)
 */
export const TILE = 16;

export const GROUND = [
  "TTTTTTTTTTTTTTTTTTTTTTTT", // 0
  "T..,.........,.......,.T", // 1
  "T......................T", // 2
  "T......................T", // 3
  "T......................T", // 4
  "T......................T", // 5
  "T...=......=.......=...T", // 6
  "T======================T", // 7  Main Street
  "T.......========.......T", // 8
  "T.......==~~~~==.......T", // 9  plaza + pond
  "T.......==~~~~==.......T", // 10
  "T..=....========...=...T", // 11
  "T======================T", // 12 Market Street
  "T......................T", // 13
  "T.,.....,.......,....,.T", // 14
  "T..,......,.....,......T", // 15
  "TTTTTTTTTTTTTTTTTTTTTTTT", // 16
] as const;

export const COLS = GROUND[0].length;
export const ROWS = GROUND.length;

export interface Point {
  x: number;
  y: number;
}

/** What interacting with an object does. */
export type Target = { type: "place"; id: string } | { type: "link"; id: string };

export type ObjectKind = "building" | "garden" | "stall" | "board" | "signpost" | "mailbox" | "npc";

export interface TownObject {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Walkable entrance tile. Stepping onto it triggers the target (a link door opens in a new tab). */
  door?: Point;
  target: Target;
  label: string;
  /** Visual theme key for the renderer. */
  style: string;
}

export const OBJECTS: readonly TownObject[] = [
  { id: "home", kind: "building", x: 2, y: 2, w: 5, h: 4, door: { x: 4, y: 5 }, target: { type: "place", id: "home" }, label: "Home", style: "home" },
  { id: "dev", kind: "building", x: 9, y: 2, w: 6, h: 4, door: { x: 11, y: 5 }, target: { type: "place", id: "dev" }, label: "Dev Center", style: "dev" },
  { id: "career", kind: "building", x: 17, y: 2, w: 5, h: 4, door: { x: 19, y: 5 }, target: { type: "place", id: "career" }, label: "Career Hall", style: "career" },
  { id: "music", kind: "building", x: 2, y: 8, w: 4, h: 3, door: { x: 3, y: 10 }, target: { type: "place", id: "music" }, label: "Music Room", style: "music" },
  { id: "arcade", kind: "building", x: 17, y: 8, w: 5, h: 3, door: { x: 19, y: 10 }, target: { type: "place", id: "arcade" }, label: "Arcade", style: "arcade" },
  { id: "garden", kind: "garden", x: 2, y: 13, w: 6, h: 3, door: { x: 4, y: 13 }, target: { type: "place", id: "garden" }, label: "Interests Garden", style: "garden" },
  { id: "twin", kind: "npc", x: 9, y: 9, w: 1, h: 1, target: { type: "place", id: "twin" }, label: "Digital Twin", style: "twin" },
  { id: "linkedin", kind: "board", x: 9, y: 13, w: 2, h: 1, target: { type: "link", id: "linkedin" }, label: "LinkedIn", style: "linkedin" },
  { id: "github", kind: "signpost", x: 12, y: 13, w: 1, h: 1, target: { type: "link", id: "github" }, label: "GitHub", style: "github" },
  { id: "email", kind: "mailbox", x: 14, y: 13, w: 1, h: 1, target: { type: "link", id: "email" }, label: "Email", style: "email" },
  { id: "depop", kind: "stall", x: 16, y: 13, w: 4, h: 2, door: { x: 18, y: 14 }, target: { type: "link", id: "depop" }, label: "Depop", style: "depop" },
];

export const SPAWN: Point = { x: 11, y: 7 };
