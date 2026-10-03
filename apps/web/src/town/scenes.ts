/**
 * Every walkable map: the town, plus building interiors you step into, old-school RPG style.
 * An interior is keyed by the place id of the page that shows it.
 */
import { ARCADE_GROUND, ARCADE_OBJECTS, ARCADE_SPAWN, bakeArcade } from "./arcade.ts";
import type { Dir } from "./grid.ts";
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
};
