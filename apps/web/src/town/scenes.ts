/**
 * Every walkable map: the town, plus building interiors you step into, old-school RPG style.
 * An interior is keyed by the place id of the page that shows it.
 */
import { ARCADE_GROUND, ARCADE_OBJECTS, ARCADE_SPAWN, bakeArcade } from "./arcade.ts";
import { DEV_GROUND, DEV_OBJECTS, DEV_SPAWN, bakeDev, drawDevLive } from "./dev.ts";
import type { Dir } from "./grid.ts";
import { HOME_GROUND, HOME_OBJECTS, HOME_SPAWN, bakeHome, drawHomeLive, drawHomeOver } from "./home.ts";
import { LAB_GROUND, LAB_OBJECTS, LAB_SPAWN, bakeLab, drawLabLive } from "./lab.ts";
import { GROUND, OBJECTS, SPAWN, type Point, type TownObject } from "./map.ts";
import { bakeWorld } from "./world.ts";

export interface Scene {
  id: string;
  ground: readonly string[];
  objects: readonly TownObject[];
  spawn: Point;
  /** Which way the visitor faces on arrival. */
  face: Dir;
  /** Fill colour around the map when the screen is bigger than it. */
  backdrop: string;
  bake: () => HTMLCanvasElement;
  /**
   * Art drawn over the baked map every frame, in world pixels: things that change over time (a
   * clock) or must layer with the visitor (a couch they can walk behind). `draw` paints beneath the
   * visitor and `drawOver` on top; both get the visitor's position. The room also repaints every
   * `everyMs` while it is shown.
   */
  live?: {
    draw: (ctx: CanvasRenderingContext2D, player: Point) => void;
    drawOver?: (ctx: CanvasRenderingContext2D, player: Point) => void;
    everyMs: number;
  };
  /** Pixel font and old-RPG text boxes for this scene's name tags and messages. */
  retro?: boolean;
  /** Shown in the town bubble on entering. */
  intro?: { title: string; text: string };
}

export const TOWN: Scene = { id: "town", ground: GROUND, objects: OBJECTS, spawn: SPAWN, face: "down", backdrop: "#4f9d4a", bake: bakeWorld };

export const INTERIORS: Record<string, Scene> = {
  arcade: {
    id: "arcade",
    ground: ARCADE_GROUND,
    objects: ARCADE_OBJECTS,
    spawn: ARCADE_SPAWN,
    face: "up",
    backdrop: "#120d22",
    bake: bakeArcade,
    retro: true,
    intro: { title: "Arcade", text: "Walk up to the robot and press Enter (or tap it) to play Mancala. Step on the mat to leave." },
  },
  dev: {
    id: "dev",
    ground: DEV_GROUND,
    objects: DEV_OBJECTS,
    spawn: DEV_SPAWN,
    face: "up",
    backdrop: "#070a14",
    bake: bakeDev,
    // A repaint a second: enough for the radar sweep and the blinking lights, and next to free.
    live: { draw: drawDevLive, everyMs: 1000 },
    retro: true,
    intro: {
      title: "Dev Center",
      text: "Mission control. LeBronette at the front desk can tell you all about Dan. The viewscreen runs his projects, roles, school and honors; check the stack radar and the telemetry wall too. Step on the mat to leave.",
    },
  },
  lab: {
    id: "lab",
    ground: LAB_GROUND,
    objects: LAB_OBJECTS,
    spawn: LAB_SPAWN,
    face: "up",
    backdrop: "#10201b",
    bake: bakeLab,
    live: { draw: drawLabLive, everyMs: 1000 },
    retro: true,
    intro: {
      title: "Research Lab",
      text: "Dan's research. Read the poster wall, see what's next on the whiteboard, and look over the methods on the lab bench. Step on the mat to leave.",
    },
  },
  home: {
    id: "home",
    ground: HOME_GROUND,
    objects: HOME_OBJECTS,
    spawn: HOME_SPAWN,
    face: "up",
    backdrop: "#2b1d14",
    bake: bakeHome,
    live: { draw: drawHomeLive, drawOver: drawHomeOver, everyMs: 20_000 },
    retro: true,
    intro: { title: "Home", text: "Welcome to Dan's place! Walk up to the TV and press Enter (or tap it) to watch, or leave Dan a note on the fridge. Step on the mat to leave." },
  },
};
