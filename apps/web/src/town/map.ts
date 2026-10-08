/**
 * The town layout. Pure data, with no DOM and no profile access, so it is easy to test.
 *
 * Ground legend:  T tree (solid) · . grass · , flowers · = path/paving · ~ water (solid)
 */
export const TILE = 16;

export const GROUND = [
  "TTTTTTTTTTTTTTTTTT", // 0
  "T..,......,....,.T", // 1
  "T................T", // 2
  "T................T", // 3
  "T................T", // 4
  "T................T", // 5
  "T...=.......=....T", // 6
  "T================T", // 7  Main Street
  "T.......==.......T", // 8  Center Road
  "T.......==.,.....T", // 9
  "T.......==.......T", // 10
  "T.......==.......T", // 11
  "T================T", // 12 Market Street
  "T......====...,..T", // 13
  "T......=~~=......T", // 14 plaza + pond
  "T......=~~=......T", // 15
  "T..=...====......T", // 16
  "T================T", // 17 Garden Lane
  "T................T", // 18
  "T................T", // 19
  "T.,.......,....,.T", // 20
  "TTTTTTTTTTTTTTTTTT", // 21
] as const;

export const COLS = GROUND[0].length;
export const ROWS = GROUND.length;

export interface Point {
  x: number;
  y: number;
}

/** What interacting with an object does. */
export type Target =
  | { type: "place"; id: string }
  | { type: "link"; id: string }
  | { type: "note"; text: string }
  /** A page on this site (e.g. a paper's PDF), shown in the bubble with a short description. */
  | { type: "url"; href: string; text: string; cta: string }
  /** Fires a `town:<name>` DOM event, e.g. the arcade robot opening the game. */
  | { type: "event"; name: string };

export type ObjectKind = "building" | "garden" | "stall" | "board" | "signpost" | "mailbox" | "npc" | "statue" | "prop" | "exit";

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
  /** Scenery you can still bump into and read, but without a floating name tag. */
  hideLabel?: boolean;
  /** Raise the name tag this many world pixels, for art that pokes above the object's tiles. */
  labelLift?: number;
  /**
   * The object's action, e.g. "Turn on the TV". Facing it (or walking into it) only offers the action
   * with a "Press Enter to open" prompt; Enter, a click or a tap triggers it. For things that
   * shouldn't go off by accident, like the TV at Home starting a video.
   */
  hint?: string;
}

export const OBJECTS: readonly TownObject[] = [
  { id: "home", kind: "building", x: 2, y: 2, w: 5, h: 4, door: { x: 4, y: 5 }, target: { type: "place", id: "home" }, label: "Home", style: "home" },
  { id: "lebron", kind: "statue", x: 7, y: 4, w: 1, h: 2, target: { type: "note", text: "The King. 4× NBA champion and the league's all-time leading scorer." }, label: "LeBron James", style: "lebron" },
  { id: "dev", kind: "building", x: 10, y: 2, w: 6, h: 4, door: { x: 12, y: 5 }, target: { type: "place", id: "dev" }, label: "Dev Center", style: "dev" },
  { id: "lab", kind: "building", x: 2, y: 8, w: 5, h: 4, door: { x: 4, y: 11 }, target: { type: "place", id: "lab" }, label: "Research Lab", style: "lab", labelLift: 10 },
  { id: "arcade", kind: "building", x: 11, y: 9, w: 5, h: 3, door: { x: 13, y: 11 }, target: { type: "place", id: "arcade" }, label: "Arcade", style: "arcade" },
  { id: "music", kind: "building", x: 2, y: 13, w: 4, h: 3, door: { x: 3, y: 15 }, target: { type: "place", id: "music" }, label: "Music Room", style: "music" },
  { id: "twin", kind: "npc", x: 7, y: 9, w: 1, h: 1, target: { type: "place", id: "twin" }, label: "Digital Twin", style: "twin" },
  { id: "depop", kind: "stall", x: 12, y: 15, w: 4, h: 2, door: { x: 14, y: 16 }, target: { type: "link", id: "depop" }, label: "Depop", style: "depop" },
  { id: "garden", kind: "garden", x: 2, y: 18, w: 6, h: 3, door: { x: 4, y: 18 }, target: { type: "place", id: "garden" }, label: "Interests Garden", style: "garden" },
  { id: "linkedin", kind: "board", x: 9, y: 19, w: 2, h: 1, target: { type: "link", id: "linkedin" }, label: "LinkedIn", style: "linkedin" },
  { id: "github", kind: "signpost", x: 12, y: 19, w: 1, h: 1, target: { type: "link", id: "github" }, label: "GitHub", style: "github" },
  { id: "email", kind: "mailbox", x: 14, y: 19, w: 1, h: 1, target: { type: "link", id: "email" }, label: "Email", style: "email" },
];

export const SPAWN: Point = { x: 11, y: 7 };
