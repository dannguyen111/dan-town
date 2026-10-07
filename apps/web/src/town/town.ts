/**
 * The town controller: input → grid movement → rendering.
 *
 * Performance contract: nothing runs while the visitor is idle. The rAF loop starts on input
 * and stops as soon as the player is standing still with no queued path or held key.
 */
import { DELTA, TownGrid, dirBetween, type Dir } from "./grid.ts";
import { TILE, type Point, type TownObject } from "./map.ts";
import { PovView, type PovId } from "./pov.ts";
import { INTERIORS, TOWN, type Scene } from "./scenes.ts";
import { PLAYER_PALETTE, SPRITE_H, SPRITE_W, TWIN_PALETTE, bakeSprites, type SpriteSheet } from "./sprites.ts";

export interface TownConfig {
  places: Record<string, { name: string; href: string }>;
  links: Record<string, { label: string; url: string | null }>;
  /** Called when the visitor enters a place. Return a promise that resolves after navigation. */
  onEnterPlace: (placeId: string, href: string) => void;
  /** Called when the visitor interacts with an object whose target is an event. */
  onEvent?: (name: string) => void;
}

const STEP_MS = 150;
const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};
const LETTER_DIRS: Record<string, Dir> = { w: "up", a: "left", s: "down", d: "right" };

/** Physical key (layout-independent WASD) first, then the logical key as a fallback. */
const dirFor = (e: KeyboardEvent): Dir | undefined => KEY_DIRS[e.code] ?? KEY_DIRS[e.key] ?? LETTER_DIRS[(e.key ?? "").toLowerCase()];

export class Town {
  private scene: Scene = TOWN;
  private grid = new TownGrid();
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  /** Each scene's art is baked on first visit and kept. */
  private readonly baked = new Map<string, HTMLCanvasElement>([[TOWN.id, TOWN.bake()]]);
  private world = this.baked.get(TOWN.id)!;
  private readonly playerSprites: SpriteSheet = bakeSprites(PLAYER_PALETTE);
  private readonly twinSprites: SpriteSheet = bakeSprites(TWIN_PALETTE, { headphones: true });
  private readonly labels = new Map<string, HTMLElement>();
  private readonly bubble: HTMLElement;
  /** The link (or action button) in the open bubble, followed when the visitor presses Enter. */
  private bubbleLink: HTMLAnchorElement | HTMLButtonElement | null = null;
  /** The open bubble is a "press Enter" prompt for the object the visitor faces; it closes when they move. */
  private facingPrompt = false;
  /** Typewriter timer (retro scenes) and the timer that fades the bubble away. */
  private typer = 0;
  private dismiss = 0;
  /**
   * In retro scenes, the machine (prop) whose box was just shown. Bumping it again stays quiet until
   * the visitor steps away, so standing against a machine doesn't keep re-opening its box.
   */
  private quietObj: string | null = null;
  /** The object whose "press Enter" hint was just shown by walking into it (same idea as quietObj). */
  private hinted: string | null = null;
  /** Repaints scenes with live art (e.g. the clock at Home) while they are shown. */
  private liveTimer = 0;
  private readonly live: HTMLElement;
  private readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  /** A close-up view drawn instead of the room (the twin on the couch while you chat), or null. */
  private pov: { id: PovId; view: PovView } | null = null;
  private readonly roomLabel: string;

  // Player state
  private pos: Point = { ...TOWN.spawn };
  private from: Point = { ...TOWN.spawn };
  private facing: Dir = "down";
  private stepStart = 0;
  private moving = false;
  private stepCount = 0;
  private path: Point[] = [];
  private pendingInteract: { obj: TownObject; face: Dir } | null = null;
  private marker: Point | null = null;
  private readonly held: Dir[] = [];

  // View state
  private scale = 2;
  private cam = { x: 0, y: 0 };
  private raf = 0;
  private enabled = true;
  /** Pixels at the bottom of the town covered by an overlay (the mobile peek card). */
  private bottomInset = 0;

  constructor(private readonly root: HTMLElement, private readonly config: TownConfig) {
    this.canvas = root.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.bubble = root.querySelector("[data-town-bubble]")!;
    // In retro scenes (the arcade), bubbles fade away on their own, but not while someone is
    // pointing at or tabbing through one. Town bubbles stay until closed.
    this.bubble.addEventListener("pointerenter", () => this.holdBubble());
    this.bubble.addEventListener("focusin", () => this.holdBubble());
    this.bubble.addEventListener("pointerleave", () => this.scheduleDismiss());
    this.bubble.addEventListener("focusout", () => this.scheduleDismiss());
    this.live = root.querySelector("[data-town-live]")!;
    this.roomLabel = this.canvas.getAttribute("aria-label") ?? "";
    this.buildLabels();
    this.bindInput();
    new ResizeObserver(() => this.resize()).observe(root);
    this.resize();
  }

  // ───────────────────────────── public API ─────────────────────────────

  get sceneId() {
    return this.scene.id;
  }

  hasInterior(placeId: string) {
    return placeId in INTERIORS;
  }

  /**
   * Whether the room the visitor is in has its own way into a place, like the twin on the Home
   * couch. Its page can then open beside the room without leaving it.
   */
  hasPlaceHere(placeId: string) {
    return this.scene !== TOWN && this.scene.objects.some((o) => !o.door && o.target.type === "place" && o.target.id === placeId);
  }

  /**
   * Switch maps: "town", or the id of a place with an interior. The visitor appears at the
   * scene's entrance. Returns false if already there.
   */
  enterScene(id: string) {
    const scene = id === TOWN.id ? TOWN : INTERIORS[id];
    if (!scene || scene === this.scene) return false;
    this.setPov(null);
    this.scene = scene;
    this.grid = new TownGrid(scene.objects, scene.ground);
    if (!this.baked.has(scene.id)) this.baked.set(scene.id, scene.bake());
    this.world = this.baked.get(scene.id)!;
    this.root.dataset.scene = scene.id;
    this.root.toggleAttribute("data-retro", !!scene.retro);
    this.placePlayer(scene.spawn, scene.face);
    this.buildLabels();
    clearInterval(this.liveTimer);
    if (scene.live) {
      this.liveTimer = window.setInterval(() => document.hidden || this.draw(performance.now()), scene.live.everyMs);
    }
    this.resize();
    if (scene.intro) this.showNote(scene.intro.title, scene.intro.text);
    if (!this.reducedMotion.matches) {
      this.canvas.animate([{ filter: "brightness(0)" }, { filter: "brightness(1)" }], { duration: 450, easing: "ease-out" });
    }
    return true;
  }

  /** Place the player next to a location (Map menu jumps, deep links, leaving a building). */
  teleportToPlace(placeId: string, facing?: Dir) {
    const obj = this.scene.objects.find((o) => o.target.type === "place" && o.target.id === placeId);
    if (!obj) return;
    const { at, face } = this.grid.arrivalTile(obj, this.scene.spawn);
    this.placePlayer(at, facing ?? face);
  }

  /**
   * Show a close-up of the room instead of the map: "couch" is the twin facing you while you chat.
   * Walking pauses until it's cleared with null. The cut zooms in on the object it shows.
   */
  setPov(id: PovId | null) {
    if ((this.pov?.id ?? null) === id) return;
    const from = id === "couch" ? this.objectScreenRect("twin") : null;
    this.pov?.view.destroy();
    // Sitting down with him at Home, he takes his headphones off to talk.
    this.pov = id ? { id, view: new PovView(this.canvas, id, { phonesOff: id === "couch" }) } : null;
    if (id) this.root.dataset.pov = id;
    else delete this.root.dataset.pov;
    this.canvas.setAttribute("aria-label", id === "couch" ? "The digital twin on the couch, facing you, with posters on the wall behind him." : this.roomLabel);
    this.held.length = 0;
    this.hideBubble();
    if (this.pov) this.pov.view.start();
    else this.resize();
    if (this.reducedMotion.matches) return;
    if (from) {
      const box = this.canvas.getBoundingClientRect();
      const origin = `${from.left + from.width / 2 - box.left}px ${from.top + from.height / 2 - box.top}px`;
      this.canvas.animate(
        [
          { transform: "scale(1.6)", transformOrigin: origin, filter: "brightness(0.4)" },
          { transform: "scale(1)", transformOrigin: origin, filter: "brightness(1)" },
        ],
        { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    } else {
      this.canvas.animate([{ filter: "brightness(0.4)" }, { filter: "brightness(1)" }], { duration: 300, easing: "ease-out" });
    }
  }

  /** Where an object of the current room is on screen (viewport CSS pixels), e.g. to zoom in from it. */
  objectScreenRect(id: string): DOMRect | null {
    const obj = this.scene.objects.find((o) => o.id === id);
    if (!obj || this.pov) return null;
    const box = this.canvas.getBoundingClientRect();
    const lift = obj.labelLift ?? 0;
    const x = (obj.x * TILE - this.cam.x) * this.scale + box.left;
    const y = (obj.y * TILE - lift - this.cam.y) * this.scale + box.top;
    return new DOMRect(x, y, obj.w * TILE * this.scale, (obj.h * TILE + lift) * this.scale);
  }

  setActivePlace(placeId: string | null) {
    for (const [id, el] of this.labels) {
      const obj = this.scene.objects.find((o) => o.id === id)!;
      el.toggleAttribute("aria-current", obj.target.type === "place" && obj.target.id === placeId);
    }
  }

  /** Show a short message in the bubble, e.g. a hint on entering a room. */
  showNote(title: string, text: string) {
    this.showLinkBubble({ id: "note", kind: "prop", x: 0, y: 0, w: 0, h: 0, target: { type: "note", text }, label: title, style: "" });
  }

  /** Keep the player centred in the part of the town that isn't covered by overlays. */
  setBottomInset(px: number) {
    if (Math.abs(px - this.bottomInset) < 1) return;
    this.bottomInset = Math.max(0, px);
    this.centerCamera(true);
    this.draw(performance.now());
  }

  focus() {
    this.canvas.focus({ preventScroll: true });
  }

  /** Stop listening to movement keys, e.g. while a full-screen game covers the town. */
  setEnabled(on: boolean) {
    this.enabled = on;
    this.held.length = 0;
  }

  private placePlayer(at: Point, facing: Dir) {
    this.path = [];
    this.held.length = 0;
    this.pendingInteract = null;
    this.moving = false;
    this.pos = { ...at };
    this.from = { ...at };
    this.facing = facing;
    this.marker = null;
    this.quietObj = null;
    this.hinted = null;
    this.hideBubble();
    this.centerCamera(true);
    this.requestFrame();
  }

  // ───────────────────────────── input ─────────────────────────────

  private bindInput() {
    // While a link bubble is open, Enter follows the link and Escape dismisses it. Capture phase
    // so this wins over the canvas's own Enter-to-interact.
    window.addEventListener(
      "keydown",
      (e) => {
        if (this.bubble.hidden || !this.keyboardTargetsTown(e)) return;
        // A focused link/button in the bubble already handles Enter natively.
        if (this.bubble.contains(document.activeElement)) return;
        if (e.key === "Escape" || (e.key === "Enter" && this.bubbleLink)) {
          e.preventDefault();
          e.stopPropagation();
          if (e.key === "Enter") this.bubbleLink?.click();
          this.hideBubble();
          this.focus();
        }
      },
      { capture: true },
    );
    window.addEventListener("keydown", (e) => {
      const dir = dirFor(e);
      if (!dir || !this.keyboardTargetsTown(e)) return;
      e.preventDefault();
      this.path = [];
      this.pendingInteract = null;
      this.marker = null;
      if (!this.held.includes(dir)) this.held.push(dir);
      // Town bubbles close as you walk off; retro (arcade) bubbles fade on their own instead,
      // so holding a key against a machine doesn't flicker its box.
      if (!this.scene.retro) this.hideBubble();
      // Start the step now, so a quick tap (keyup before the next frame) still moves one tile.
      if (!this.moving) this.startNextStep(performance.now());
      this.requestFrame();
    });
    window.addEventListener("keyup", (e) => {
      const dir = dirFor(e);
      if (dir) this.held.splice(this.held.indexOf(dir) >>> 0, 1);
    });
    window.addEventListener("blur", () => (this.held.length = 0));

    this.canvas.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !this.pov) {
        e.preventDefault();
        this.interactFacing();
      }
    });

    this.canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || this.pov) return;
      const rect = this.canvas.getBoundingClientRect();
      const wx = (e.clientX - rect.left) / this.scale + this.cam.x;
      const wy = (e.clientY - rect.top) / this.scale + this.cam.y;
      this.walkToTile({ x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) });
    });
  }

  /** Keys move the player unless the visitor is typing or working inside the content panel. */
  private keyboardTargetsTown(e: KeyboardEvent) {
    if (!this.enabled || this.pov || e.altKey || e.ctrlKey || e.metaKey) return false;
    const el = document.activeElement;
    if (!el || el === document.body || el === this.canvas) return !document.querySelector("dialog[open]");
    return this.root.contains(el) && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement);
  }

  walkToObject(obj: TownObject) {
    const plan = this.grid.approach(obj, this.pos);
    if (!plan) return;
    this.held.length = 0;
    this.path = plan.path;
    this.pendingInteract = { obj, face: plan.face };
    this.marker = plan.path.at(-1) ?? null;
    this.hideBubble();
    if (!plan.path.length) this.finishPath();
    this.requestFrame();
  }

  private walkToTile(tile: Point) {
    const obj = this.grid.objectAt(tile.x, tile.y);
    if (obj) return this.walkToObject(obj);
    const path = this.grid.findPath(this.pos, tile);
    if (!path) return;
    this.held.length = 0;
    this.path = path;
    this.pendingInteract = null;
    this.marker = tile;
    this.hideBubble();
    this.requestFrame();
  }

  // ───────────────────────────── movement ─────────────────────────────

  private requestFrame() {
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  private tick(now: number) {
    this.raf = 0;
    if (this.moving && now - this.stepStart >= this.stepDuration()) {
      this.moving = false;
      this.onArrive();
    }
    if (!this.moving) this.startNextStep(now);
    this.centerCamera(false, now);
    this.draw(now);
    if (this.moving || this.path.length || this.held.length) this.requestFrame();
  }

  private stepDuration() {
    return this.reducedMotion.matches ? 90 : STEP_MS;
  }

  private startNextStep(now: number) {
    let next: Point | undefined;
    if (this.path.length) {
      next = this.path.shift()!;
      if (!this.grid.isWalkable(next.x, next.y)) {
        this.path = [];
        return;
      }
      this.facing = dirBetween(this.pos, next);
    } else if (this.held.length) {
      const dir = this.held[this.held.length - 1]!;
      this.facing = dir;
      const target = { x: this.pos.x + DELTA[dir].x, y: this.pos.y + DELTA[dir].y };
      if (!this.grid.isWalkable(target.x, target.y)) {
        // Bumping into a sign, stall or NPC interacts with it.
        const obj = this.grid.objectAt(target.x, target.y);
        if (obj && !obj.door) {
          this.held.length = 0;
          if (obj.hint) this.showHint(obj, obj.hint);
          else this.trigger(obj);
        }
        return;
      }
      next = target;
    }
    if (!next) return;
    if (this.facingPrompt) this.hideBubble();
    this.from = { ...this.pos };
    this.pos = next;
    this.quietObj = null;
    this.hinted = null;
    this.moving = true;
    this.stepStart = now;
    this.stepCount++;
  }

  private onArrive() {
    const door = this.grid.doorAt(this.pos.x, this.pos.y);
    if (door) {
      this.path = [];
      this.held.length = 0;
      this.pendingInteract = null;
      this.marker = null;
      this.trigger(door);
      return;
    }
    if (!this.path.length) this.finishPath();
  }

  private finishPath() {
    this.marker = null;
    if (this.pendingInteract) {
      const { obj, face } = this.pendingInteract;
      this.pendingInteract = null;
      this.facing = face;
      if (!obj.door) this.trigger(obj);
    } else {
      this.promptFacing();
    }
  }

  /** Standing still facing something you use on purpose (the TV, the fridge) offers to open it. */
  private promptFacing() {
    const obj = this.grid.objectAt(this.pos.x + DELTA[this.facing].x, this.pos.y + DELTA[this.facing].y);
    if (obj?.hint) this.showHint(obj, obj.hint);
  }

  private interactFacing() {
    const t = { x: this.pos.x + DELTA[this.facing].x, y: this.pos.y + DELTA[this.facing].y };
    const obj = this.grid.objectAt(t.x, t.y);
    if (obj) this.walkToObject(obj);
  }

  /**
   * Facing an object with a hint shows its action with a "Press Enter to open" prompt, once, until
   * the visitor steps away. Enter (or a tap on the action) triggers it.
   */
  private showHint(obj: TownObject, hint: string) {
    if (obj.id === this.hinted && !this.bubble.hidden) return;
    this.hinted = obj.id;
    this.holdBubble();
    clearInterval(this.typer);
    this.bubble.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = obj.label;
    const action = document.createElement("button");
    action.type = "button";
    action.className = "town-bubble__action";
    action.textContent = hint;
    action.addEventListener("click", () => {
      this.hideBubble();
      this.trigger(obj);
    });
    const prompt = document.createElement("span");
    prompt.className = "town-bubble__hint";
    prompt.setAttribute("aria-hidden", "true");
    prompt.innerHTML = "Press <kbd>Enter</kbd> to open";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "town-bubble__close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", () => {
      this.hideBubble();
      this.focus();
    });
    this.bubble.append(title, action, prompt, close);
    this.bubbleLink = action;
    this.facingPrompt = true;
    this.bubble.hidden = false;
    this.announce(`${obj.label}: ${hint}. Press Enter to open.`);
  }

  private trigger(obj: TownObject) {
    if (this.scene.retro && obj.kind === "prop" && !obj.hint) {
      if (obj.id === this.quietObj) return;
      this.quietObj = obj.id;
    }
    if (obj.target.type === "event") {
      this.hideBubble();
      this.config.onEvent?.(obj.target.name);
    } else if (obj.target.type === "place") {
      const place = this.config.places[obj.target.id];
      if (!place) return;
      this.announce(`Entering ${place.name}`);
      // Walking into a room (or back out to town) switches scenes, so stay in the doorway rather
      // than turning around on the street while the next page loads.
      const changesScene = obj.target.id in INTERIORS || (this.scene !== TOWN && obj.target.id === TOWN.id);
      if (!changesScene) this.stepOutOfDoor(obj);
      this.config.onEnterPlace(obj.target.id, place.href);
    } else if (obj.door && obj.target.type === "link") {
      // Walking through a link door opens it in a new tab. Fall back to the bubble if
      // there is no URL or the popup blocker stops us (e.g. the walk outlasted the click).
      // ("noopener" would make window.open always return null, so detach the opener by hand.)
      const url = this.config.links[obj.target.id]?.url;
      this.stepOutOfDoor(obj);
      const tab = url ? window.open(url, "_blank") : null;
      if (tab) {
        tab.opener = null;
        this.announce(`Opening ${obj.label} in a new tab`);
      } else {
        this.showLinkBubble(obj);
      }
    } else {
      this.showLinkBubble(obj);
    }
    this.requestFrame();
  }

  /** Step back out of the doorway so the next visit doesn't re-trigger instantly. */
  private stepOutOfDoor(obj: TownObject) {
    if (!obj.door) return;
    const { at, face } = this.grid.arrivalTile(obj, this.from);
    this.pos = { ...at };
    this.from = { ...at };
    this.facing = face === "up" ? "down" : face;
  }

  // ───────────────────────────── UI overlays ─────────────────────────────

  private buildLabels() {
    const layer = this.root.querySelector<HTMLElement>("[data-town-labels]")!;
    layer.replaceChildren();
    this.labels.clear();
    for (const obj of this.scene.objects) {
      if (obj.hideLabel) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.className = `town-label town-label--${obj.kind}`;
      el.textContent = obj.label;
      const noun = obj.kind === "statue" ? " statue" : obj.kind === "prop" || obj.kind === "npc" ? "" : " sign";
      el.setAttribute(
        "aria-label",
        obj.kind === "npc" ? `Talk to the ${obj.label}` : obj.target.type === "place" ? `Walk to ${obj.label}` : `Walk to the ${obj.label}${noun}`,
      );
      el.addEventListener("click", () => {
        this.walkToObject(obj);
        this.focus();
      });
      layer.append(el);
      this.labels.set(obj.id, el);
    }
  }

  private showLinkBubble(obj: TownObject) {
    const { target } = obj;
    this.facingPrompt = false;
    const url = target.type === "link" ? this.config.links[target.id]?.url : target.type === "url" ? target.href : undefined;
    this.holdBubble();
    this.bubble.replaceChildren();
    this.bubbleLink = null;
    const title = document.createElement("strong");
    title.textContent = obj.label;
    this.bubble.append(title);
    if (obj.target.type === "note") {
      const p = document.createElement("span");
      this.bubble.append(p);
      this.typeInto(p, obj.target.text);
    } else if (url) {
      if (target.type === "url") {
        const p = document.createElement("span");
        p.textContent = target.text;
        this.bubble.append(p);
      }
      const a = document.createElement("a");
      a.href = url;
      a.textContent = target.type === "url" ? target.cta : url.startsWith("mailto:") ? "Send me an email ✉️" : `Open ${obj.label} ↗`;
      if (!url.startsWith("mailto:")) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      a.addEventListener("click", () => this.hideBubble());
      this.bubble.append(a);
      this.bubbleLink = a;
      const hint = document.createElement("span");
      hint.className = "town-bubble__hint";
      hint.setAttribute("aria-hidden", "true");
      hint.innerHTML = "Press <kbd>Enter</kbd> to open";
      this.bubble.append(hint);
    } else {
      const p = document.createElement("span");
      p.textContent = "Opening soon. Check back later!";
      this.bubble.append(p);
    }
    // Notes start their countdown once fully typed; everything else right away.
    if (obj.target.type !== "note") this.scheduleDismiss();
    const close = document.createElement("button");
    close.type = "button";
    close.className = "town-bubble__close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", () => {
      this.hideBubble();
      this.focus();
    });
    this.bubble.append(close);
    this.bubble.hidden = false;
    this.announce(
      target.type === "note" ? `${obj.label}: ${target.text}` : url ? `${obj.label} link available. Press Enter to open it.` : `${obj.label}: opening soon`,
    );
  }

  /** Retro scenes type notes out letter by letter, like an old RPG text box. */
  private typeInto(el: HTMLElement, text: string) {
    clearInterval(this.typer);
    if (!this.scene.retro || this.reducedMotion.matches) {
      el.textContent = text;
      return this.scheduleDismiss();
    }
    let i = 0;
    this.typer = window.setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) return;
      clearInterval(this.typer);
      this.scheduleDismiss();
    }, 20);
  }

  /** In retro scenes, fade the bubble away 3 seconds from now (unless the pointer or focus is on it). */
  private scheduleDismiss() {
    clearTimeout(this.dismiss);
    if (!this.scene.retro || this.bubble.matches(":hover, :focus-within")) return;
    this.dismiss = window.setTimeout(() => {
      this.bubble.classList.add("is-leaving");
      this.dismiss = window.setTimeout(() => this.hideBubble(), this.reducedMotion.matches ? 0 : 300);
    }, 3000);
  }

  /** Cancel a pending fade, e.g. while the pointer is over the bubble. */
  private holdBubble() {
    clearTimeout(this.dismiss);
    this.bubble.classList.remove("is-leaving");
  }

  private hideBubble() {
    clearInterval(this.typer);
    this.holdBubble();
    this.bubble.hidden = true;
    this.bubbleLink = null;
    this.facingPrompt = false;
  }

  private announce(text: string) {
    this.live.textContent = text;
  }

  // ───────────────────────────── view ─────────────────────────────

  private resize() {
    const cssW = this.root.clientWidth;
    const cssH = this.root.clientHeight;
    if (!cssW || !cssH) return;
    const dpr = window.devicePixelRatio || 1;
    const mapW = this.grid.cols * TILE;
    const mapH = this.grid.rows * TILE;
    // Fit the whole town when there is room; otherwise keep characters big and follow with a camera.
    const fit = Math.min(cssW / mapW, cssH / mapH);
    const minScale = cssW < 640 ? 2.25 : 2;
    const cssScale = Math.max(fit, minScale);
    // Snap to whole device pixels so pixel art stays crisp.
    const deviceScale = Math.max(1, Math.floor(cssScale * dpr));
    this.scale = deviceScale / dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.centerCamera(true);
    this.draw(performance.now());
  }

  /** Player position in world pixels, tweened between tiles. */
  private playerPx(now: number): Point {
    const t = this.moving && !this.reducedMotion.matches ? Math.min(1, (now - this.stepStart) / this.stepDuration()) : 1;
    return {
      x: (this.from.x + (this.pos.x - this.from.x) * t) * TILE,
      y: (this.from.y + (this.pos.y - this.from.y) * t) * TILE,
    };
  }

  private centerCamera(snap: boolean, now = performance.now()) {
    const viewW = this.root.clientWidth / this.scale;
    const viewH = this.root.clientHeight / this.scale;
    const visibleH = Math.max(viewH / 3, (this.root.clientHeight - this.bottomInset) / this.scale);
    const mapW = this.grid.cols * TILE;
    const mapH = this.grid.rows * TILE;
    const p = this.playerPx(now);
    const clamp = (v: number, view: number, map: number) => (view >= map ? (map - view) / 2 : Math.max(0, Math.min(map - view, v)));
    const target = { x: clamp(p.x + TILE / 2 - viewW / 2, viewW, mapW), y: clamp(p.y + TILE / 2 - visibleH / 2, viewH, mapH) };
    if (snap || this.reducedMotion.matches) this.cam = target;
    else {
      this.cam.x += (target.x - this.cam.x) * 0.25;
      this.cam.y += (target.y - this.cam.y) * 0.25;
      if (Math.abs(target.x - this.cam.x) < 0.5) this.cam.x = target.x;
      if (Math.abs(target.y - this.cam.y) < 0.5) this.cam.y = target.y;
      if (this.cam.x !== target.x || this.cam.y !== target.y) this.requestFrame();
    }
  }

  private draw(now: number) {
    // A close-up draws itself; resizing cleared the canvas, so have it draw again.
    if (this.pov) return this.pov.view.redraw();
    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    const s = this.scale * dpr;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.scene.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Round the camera to whole device pixels to avoid shimmering seams.
    const ox = Math.round(-this.cam.x * s);
    const oy = Math.round(-this.cam.y * s);
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.drawImage(this.world, 0, 0);

    if (this.marker) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      const mx = this.marker.x * TILE;
      const my = this.marker.y * TILE;
      ctx.fillRect(mx + 4, my + 12, 8, 2);
      ctx.fillRect(mx + 6, my + 11, 4, 4);
    }

    // Scenes can draw the twin their own way (sitting on the couch at Home) in their live layer.
    const twin = this.scene.objects.find((o) => o.id === "twin" && o.style === "twin");
    if (twin) this.drawTwin(twin);

    const p = this.playerPx(now);
    this.scene.live?.draw(ctx, p);
    const frame = this.moving && !this.reducedMotion.matches ? ((this.stepCount % 2) + 1) as 1 | 2 : 0;
    this.drawCharacter(this.playerSprites, this.facing, frame, p.x, p.y);
    this.scene.live?.drawOver?.(ctx, p);

    this.positionLabels();
  }

  /** Twin NPC with a speech-bubble hint. */
  private drawTwin(twin: TownObject) {
    const { ctx } = this;
    this.drawCharacter(this.twinSprites, "down", 0, twin.x * TILE, twin.y * TILE);
    ctx.fillStyle = "#3b2a2a";
    ctx.fillRect(twin.x * TILE + 10, twin.y * TILE - 12, 9, 8);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(twin.x * TILE + 11, twin.y * TILE - 11, 7, 6);
    ctx.fillStyle = "#2bb3a3";
    ctx.fillRect(twin.x * TILE + 12, twin.y * TILE - 9, 1, 1);
    ctx.fillRect(twin.x * TILE + 14, twin.y * TILE - 9, 1, 1);
    ctx.fillRect(twin.x * TILE + 16, twin.y * TILE - 9, 1, 1);
  }

  private drawCharacter(sheet: SpriteSheet, dir: Dir, frame: 0 | 1 | 2, x: number, y: number) {
    const { ctx } = this;
    ctx.fillStyle = "rgba(40,60,20,0.25)";
    ctx.fillRect(x + 3, y + 13, 10, 3);
    // Sprites are taller than a tile so characters read clearly; feet sit on the tile.
    ctx.drawImage(sheet[dir][frame], x + (TILE - SPRITE_W) / 2, y + TILE - SPRITE_H - 1);
  }

  private positionLabels() {
    const viewW = this.root.clientWidth;
    for (const obj of this.scene.objects) {
      const el = this.labels.get(obj.id);
      if (!el) continue;
      const cx = ((obj.x + obj.w / 2) * TILE - this.cam.x) * this.scale;
      const top = (obj.y * TILE - (obj.labelLift ?? 0) - this.cam.y) * this.scale - (obj.kind === "npc" ? 30 : 6);
      const visible = cx > -40 && cx < viewW + 40 && top > -20 && top < this.root.clientHeight;
      el.style.transform = `translate(${Math.round(cx)}px, ${Math.round(top)}px) translate(-50%, -100%)`;
      el.style.visibility = visible ? "visible" : "hidden";
    }
  }
}
