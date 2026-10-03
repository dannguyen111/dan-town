/**
 * The arcade's full-screen Mancala "battle", styled like a Game Boy Color RPG: a typewriter
 * text box, ▶ menus, HP-style win bars, and stones sown one pit at a time.
 *
 * The rules still live only in the Rust engine. The sowing animation replays the stone-by-stone
 * path (one per pit, counter-clockwise, skipping the opponent's store), then the engine's
 * result is shown, so captures and end-of-game sweeps always match it.
 */
import { PLAYER_PALETTE, SPRITE_H, SPRITE_W, bakeSprites } from "../town/sprites.ts";
import { MancalaEngine } from "./client.ts";
import { LINES, ROBOT_H, ROBOT_W, drawRobot, moodFor, pick, winChance, type Mood } from "./robot.ts";
import { LEVEL_NAMES, describeRecord, fetchRecord, reportResult, wld, type MancalaLevel, type MancalaRecord } from "./record.ts";
import { Sfx } from "./sfx.ts";

const CLASSIC = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
const MAX = 0;
const STORE = [6, 13];
/** Nominal clock for the quick search that reads the robot's mood on your turn. It never touches the robot's real clock. */
const PEEK_MS = 2000;
const LEVELS: { key: MancalaLevel; label: string; ms: number; lv: number }[] = [
  { key: "easy", label: "EASY", ms: 5000, lv: 5 },
  { key: "medium", label: "MEDIUM", ms: 30000, lv: 30 },
  { key: "hard", label: "HARD", ms: 300000, lv: 99 },
];

const FAIRKALAH_INFO = [
  "In classic Kalah, the player who moves first can always win with perfect play. Not very fair!",
  "A FAIRKALAH board fixes that. The 48 stones start spread unevenly across the pits, in a layout picked so that if both players make the best possible moves, the game ends in a DRAW.",
  "No head start for anyone. Whoever slips up first loses.",
];

/** Thrown to unwind a flow when the visitor runs away or the page changes. */
const CANCEL = Symbol("cancel");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ADVANCE_KEYS = new Set(["Enter", " ", "z", "Z"]);
const KEY_DIRS: Record<string, -1 | 1> = { ArrowUp: -1, ArrowLeft: -1, w: -1, a: -1, W: -1, A: -1, ArrowDown: 1, ArrowRight: 1, s: 1, d: 1, S: 1, D: 1 };

/** The screen's parts, found once by their data- hooks. */
function elements(root: HTMLElement) {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  return {
    text: q<HTMLElement>("[data-text]"),
    live: q<HTMLElement>("[data-live]"),
    more: q<HTMLElement>("[data-more]"),
    menu: q<HTMLElement>("[data-menu]"),
    robot: q<HTMLCanvasElement>("[data-robot]"),
    foe: q<HTMLElement>("[data-foe]"),
    player: q<HTMLCanvasElement>("[data-player]"),
    rows: { top: q<HTMLElement>('[data-row="top"]'), bottom: q<HTMLElement>('[data-row="bottom"]') },
    stores: { top: q<HTMLElement>('[data-store="top"]'), bottom: q<HTMLElement>('[data-store="bottom"]') },
    bars: { foe: q<HTMLElement>("[data-foe-bar]"), me: q<HTMLElement>("[data-me-bar]") },
    pcts: { foe: q<HTMLElement>("[data-foe-pct]"), me: q<HTMLElement>("[data-me-pct]") },
    lv: q<HTMLElement>("[data-level]"),
    stats: q<HTMLElement>("[data-stats]"),
    sound: q<HTMLButtonElement>("[data-sound]"),
    run: q<HTMLButtonElement>("[data-run]"),
    dialog: q<HTMLElement>("[data-dialog]"),
    popup: q<HTMLElement>("[data-popup]"),
    popupTitle: q<HTMLElement>("[data-popup-title]"),
    popupBody: q<HTMLElement>("[data-popup-body]"),
  };
}

interface Option<T> {
  label: string;
  value: T;
}

export class Battle {
  private readonly engine = new MancalaEngine();
  private readonly sfx = new Sfx();
  private readonly el: ReturnType<typeof elements>;
  private readonly robotCtx: CanvasRenderingContext2D;
  private readonly abort = new AbortController();

  // Flow control
  private session = 0;
  private waiter: { resolve: () => void; reject: (e: unknown) => void } | null = null;
  private typing = false;
  private skip = false;
  private menu: { options: Option<unknown>[]; index: number; resolve: (v: unknown) => void } | null = null;
  private pitChoice: { legal: number[]; index: number; resolve: (idx: number) => void } | null = null;
  private blink = 0;

  // Game state
  private state = [...CLASSIC];
  private human = MAX;
  private level = LEVELS[1]!;
  private clock = 0;
  private mood: Mood = "idle";
  private lastMove = -1;
  private hot = -1;
  private flash = new Set<number>();
  private answers = { board: 0, side: 0, level: 1 };
  /** The robot's record against everyone, loaded when the screen opens (null if the API is unavailable). */
  private record: Promise<MancalaRecord | null> = Promise.resolve(null);

  constructor(private readonly root: HTMLElement) {
    this.el = elements(root);
    this.el.robot.width = ROBOT_W;
    this.el.robot.height = ROBOT_H;
    this.robotCtx = this.el.robot.getContext("2d")!;
    // The visitor's own character, seen from behind, like the player in an RPG battle.
    this.el.player.width = SPRITE_W;
    this.el.player.height = SPRITE_H;
    this.el.player.getContext("2d")!.drawImage(bakeSprites(PLAYER_PALETTE).up[0], 0, 0);
    this.bind();
    this.updateSound();
  }

  // ───────────────────────────── open / close ─────────────────────────────

  /** Start the encounter: intro, setup questions, then games until the visitor stops. */
  async open() {
    if (!this.root.hidden) return;
    const id = ++this.session;
    this.root.hidden = false;
    this.root.classList.remove("is-entering");
    void this.root.offsetWidth;
    this.root.classList.add("is-entering");
    document.dispatchEvent(new CustomEvent("town:pause"));
    this.root.focus({ preventScroll: true });
    this.resetBoard();
    this.record = fetchRecord();
    try {
      this.sfx.play("start");
      await sleep(700);
      await this.say("A wild ROBOT appeared!", true);
      await this.say("ROBOT wants to play MANCALA!", true);
      do await this.setup();
      while (await this.play());
      await this.say("ROBOT: Come back any time. I'll be here. Computing.", true);
      this.close();
    } catch (err) {
      if (id !== this.session || err === CANCEL) return;
      await this.say(`ERROR! ${err instanceof Error ? err.message : String(err)}`, true).catch(() => {});
      this.close();
    }
  }

  /** "RUN": leave mid-game, like fleeing a battle. */
  private async runAway() {
    if (this.root.hidden) return;
    this.cancel();
    const id = this.session;
    this.sfx.play("back");
    await this.say("Got away safely!").catch(() => {});
    if (id === this.session) this.close();
  }

  close() {
    this.cancel();
    this.root.hidden = true;
    document.dispatchEvent(new CustomEvent("town:resume"));
    document.dispatchEvent(new CustomEvent("town:focus"));
  }

  destroy() {
    this.cancel();
    this.abort.abort();
    if (!this.root.hidden) document.dispatchEvent(new CustomEvent("town:resume"));
  }

  /** Abandon whatever flow is running: pending waits reject, the engine stops searching. */
  private cancel() {
    this.session++;
    this.engine.reset();
    this.waiter?.reject(CANCEL);
    this.waiter = null;
    this.menu = null;
    this.pitChoice = null;
    this.el.menu.hidden = true;
    this.el.more.hidden = true;
    this.el.popup.hidden = true;
    this.setThinking(false);
  }

  private check(id: number) {
    if (id !== this.session) throw CANCEL;
  }

  // ───────────────────────────── input ─────────────────────────────

  private bind() {
    const opts = { signal: this.abort.signal };
    window.addEventListener(
      "keydown",
      (e) => {
        if (this.root.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === "Escape") {
          e.preventDefault();
          void this.runAway();
          return;
        }
        // Let Enter and Space on the sound/run buttons work normally.
        if (e.target instanceof HTMLButtonElement && e.target.closest(".gb__top")) return;
        const dir = KEY_DIRS[e.key];
        if (this.menu && dir) this.moveMenu(dir);
        else if (this.menu && ADVANCE_KEYS.has(e.key)) this.pickMenu(this.menu.index);
        else if (this.pitChoice && dir) this.movePit(dir);
        else if (this.pitChoice && ADVANCE_KEYS.has(e.key)) this.pickPit(this.pitChoice.legal[this.pitChoice.index]!);
        else if (this.pitChoice && /^[1-6]$/.test(e.key)) {
          const idx = this.layout().bottom[Number(e.key) - 1]!;
          if (this.pitChoice.legal.includes(idx)) this.pickPit(idx);
        } else if (ADVANCE_KEYS.has(e.key)) this.advance();
        else return;
        e.preventDefault();
        e.stopPropagation();
      },
      { ...opts, capture: true },
    );
    this.el.dialog.addEventListener("click", (e) => {
      if (!(e.target as Element).closest("[data-menu]")) this.advance();
    }, opts);
    this.el.popup.addEventListener("click", () => this.advance(), opts);
    this.el.run.addEventListener("click", () => void this.runAway(), opts);
    this.el.sound.addEventListener("click", () => {
      this.sfx.toggle();
      this.updateSound();
    }, opts);
  }

  /** Enter/tap: finish the line being typed, speed up sowing, or continue past ▼. */
  private advance() {
    if (this.pitChoice || this.menu) return;
    if (this.typing || this.hot >= 0) this.skip = true;
    else if (this.waiter) {
      this.sfx.play("move");
      this.waiter.resolve();
      this.waiter = null;
    }
  }

  private updateSound() {
    this.el.sound.textContent = this.sfx.on ? "♪ ON" : "♪ OFF";
    this.el.sound.setAttribute("aria-pressed", String(this.sfx.on));
  }

  // ───────────────────────────── text box ─────────────────────────────

  /** Type a line into the text box. With `wait`, show ▼ and hold until the visitor continues. */
  private async say(text: string, wait = false) {
    const id = this.session;
    this.el.live.textContent = text;
    this.el.more.hidden = true;
    this.typing = true;
    this.skip = false;
    for (let i = 1; i <= text.length; i++) {
      if (this.skip) i = text.length;
      this.el.text.textContent = text.slice(0, i);
      if (i % 3 === 0) this.sfx.play("blip");
      if (i < text.length) await sleep(24);
      this.check(id);
    }
    this.typing = false;
    this.skip = false;
    if (wait) {
      this.el.more.hidden = false;
      await new Promise<void>((resolve, reject) => (this.waiter = { resolve, reject }));
      this.el.more.hidden = true;
    } else await sleep(450);
    this.check(id);
  }

  /** An info window over the screen, closed with Enter or a tap. */
  private async info(title: string, body: string[] | HTMLElement) {
    const id = this.session;
    this.el.popupTitle.textContent = title;
    if (Array.isArray(body)) this.el.popupBody.replaceChildren(...body.map((t) => Object.assign(document.createElement("p"), { textContent: t })));
    else this.el.popupBody.replaceChildren(body);
    this.el.live.textContent = `${title}. ${this.el.popupBody.textContent}`;
    this.el.popup.hidden = false;
    this.sfx.play("select");
    await new Promise<void>((resolve, reject) => (this.waiter = { resolve, reject }));
    this.el.popup.hidden = true;
    this.check(id);
  }

  /** Ask a question with a ▶ menu, like an RPG. */
  private async choose<T>(question: string, options: Option<T>[], initial = 0): Promise<T> {
    await this.say(question);
    const id = this.session;
    const value = await new Promise<unknown>((resolve) => {
      this.menu = { options, index: initial, resolve };
      this.renderMenu();
    });
    this.check(id);
    return value as T;
  }

  private renderMenu() {
    const m = this.menu;
    this.el.menu.hidden = !m;
    if (!m) return;
    this.el.menu.replaceChildren(
      ...m.options.map((o, i) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "gb__option" + (i === m.index ? " is-current" : "");
        b.textContent = o.label;
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", String(i === m.index));
        b.addEventListener("click", () => this.pickMenu(i));
        li.append(b);
        return li;
      }),
    );
  }

  private moveMenu(dir: -1 | 1) {
    const m = this.menu!;
    m.index = (m.index + dir + m.options.length) % m.options.length;
    this.sfx.play("move");
    this.renderMenu();
  }

  private pickMenu(i: number) {
    const m = this.menu;
    if (!m) return;
    this.menu = null;
    this.el.menu.hidden = true;
    this.sfx.play("select");
    m.resolve(m.options[i]!.value);
  }

  // ───────────────────────────── the game ─────────────────────────────

  private async setup() {
    const a = this.answers;
    for (;;) {
      a.board = await this.choose("ROBOT: Which board shall we use?", [
        { label: "CLASSIC", value: 0 },
        { label: "FAIRKALAH", value: 1 },
        { label: "WHAT'S THAT?", value: 2 },
        { label: "RECORD", value: 3 },
      ], a.board);
      if (a.board < 2) break;
      if (a.board === 2) {
        await this.info("FAIRKALAH", FAIRKALAH_INFO);
        a.board = 1;
      } else {
        await this.info("ROBOT'S RECORD", recordTable(await this.loadRecord()));
        a.board = 0;
      }
    }
    a.side = await this.choose("ROBOT: Who goes first?", [
      { label: "YOU", value: 0 },
      { label: "ROBOT", value: 1 },
    ], a.side);
    const record = await this.loadRecord();
    // Each level shows the robot's wins-losses-draws there, e.g. "HARD    Lv99  16-1-0".
    const label = (l: (typeof LEVELS)[number]) => `${l.label.padEnd(7)} Lv${String(l.lv).padEnd(3)}` + (record ? ` ${wld(record[l.key])}` : "");
    a.level = await this.choose("ROBOT: How hard should I try?", LEVELS.map((l, i) => ({ label: label(l), value: i })), a.level);
  }

  /** The record fetched on open, without holding up the game for more than a moment. */
  private async loadRecord() {
    const id = this.session;
    const record = await Promise.race([this.record, sleep(1500).then(() => null)]);
    this.check(id);
    return record;
  }

  /** Play one game. Resolves true if the visitor wants a rematch. */
  private async play(): Promise<boolean> {
    const id = this.session;
    const a = this.answers;
    this.human = a.side;
    this.level = LEVELS[a.level]!;
    this.clock = this.level.ms;
    this.el.lv.textContent = `Lv${this.level.lv}`;
    this.el.stats.textContent = "";
    this.lastMove = -1;
    if (a.board === 0) this.state = [...CLASSIC];
    else {
      const { count } = await this.engine.board(0);
      const n = Math.floor(Math.random() * count);
      this.state = (await this.engine.board(n)).state;
      this.check(id);
      this.el.stats.textContent = `BOARD #${n}`;
    }
    this.setMood("neutral");
    this.setBars(0.5);
    this.render();
    this.sfx.play("start");
    await this.say(a.board === 0 ? "CLASSIC KALAH! 4 stones in every pit." : "FAIRKALAH! A board that's fair for both sides.");

    let toMove = MAX;
    let firstTurn = true;
    let over = false;
    while (!over) {
      if (toMove === this.human) {
        await this.say(firstTurn ? "What will YOU do? Pick a pit on your side." : "What will YOU do?");
        firstTurn = false;
        const move = await this.waitForPit(id);
        const before = [...this.state];
        const res = await this.engine.apply(this.state, this.human, move);
        this.check(id);
        await this.sow(before, this.human, move, res.state);
        over = res.over;
        const extra = !over && res.next === this.human;
        toMove = res.next;
        await this.afterMove(before, this.human, move, res.state, extra, over);
        if (!over) {
          const peek = await this.engine.choose(this.state, toMove, PEEK_MS);
          this.check(id);
          await this.react(peek.value);
        }
      } else {
        this.setThinking(true);
        const thinking = this.engine.choose(this.state, toMove, this.clock);
        await this.say("ROBOT is thinking...");
        const d = await thinking;
        this.check(id);
        this.setThinking(false);
        this.clock -= d.ms;
        this.el.stats.textContent = `DEPTH ${d.depth} · ${compact(d.nodes)} POS`;
        const before = [...this.state];
        const res = await this.engine.apply(this.state, toMove, d.move);
        this.check(id);
        await this.say(`ROBOT sowed ${before[d.move]} stone${before[d.move] === 1 ? "" : "s"}!`);
        await this.sow(before, toMove, d.move, res.state);
        over = res.over;
        const extra = !over && res.next === toMove;
        await this.afterMove(before, toMove, d.move, res.state, extra, over);
        toMove = res.next;
        if (!over) await this.react(d.value);
      }
    }
    await this.finish();
    return await this.choose("Play again?", [
      { label: "YES", value: true },
      { label: "NO", value: false },
    ]);
  }

  /** Wait for the visitor to pick one of their pits, by tap, arrows + Enter, or keys 1–6. */
  private waitForPit(id: number): Promise<number> {
    const legal = this.layout().bottom.filter((i) => this.state[i]! > 0);
    return new Promise<number>((resolve, reject) => {
      const prev = legal.indexOf(this.lastMove);
      this.pitChoice = { legal, index: Math.max(0, prev), resolve };
      this.waiter = { resolve: () => {}, reject };
      this.render();
    }).then((idx) => {
      this.check(id);
      return idx;
    });
  }

  private movePit(dir: -1 | 1) {
    const c = this.pitChoice!;
    c.index = (c.index + dir + c.legal.length) % c.legal.length;
    this.sfx.play("move");
    this.render();
  }

  private pickPit(idx: number) {
    const c = this.pitChoice;
    if (!c || !c.legal.includes(idx)) return;
    this.pitChoice = null;
    this.waiter = null;
    this.sfx.play("select");
    c.resolve(idx);
  }

  /** Animate the stones leaving `move` one at a time, then settle on the engine's result. */
  private async sow(before: number[], player: number, move: number, after: number[]) {
    const id = this.session;
    const s = [...before];
    let n = s[move]!;
    s[move] = 0;
    let pos = move;
    const skipStore = STORE[1 - player]!;
    this.lastMove = move;
    this.skip = false;
    for (let k = 1; n > 0; ) {
      pos = (pos + 1) % 14;
      if (pos === skipStore) continue;
      s[pos]!++;
      n--;
      this.hot = pos;
      this.state = s;
      this.render();
      this.sfx.play(pos === STORE[player] ? "store" : "drop", 1 + k++ * 0.05);
      if (!this.skip) await sleep(170);
      this.check(id);
    }
    this.hot = -1;
    this.skip = false;
    // Anything else that changed (a capture, or the end-of-game sweep) flashes.
    this.flash = new Set(after.flatMap((v, i) => (v !== s[i] ? [i] : [])));
    this.state = [...after];
    this.render();
    if (this.flash.size) await sleep(500);
    this.flash.clear();
    this.render();
  }

  private async afterMove(before: number[], player: number, move: number, after: number[], extra: boolean, over: boolean) {
    const who = player === this.human ? "You" : "ROBOT";
    if (over) return;
    // Stones sown into your own store vs. what the store actually gained: the rest is a capture
    // (the landing stone plus the opposite pit). Landing opposite an empty pit only banks one stone.
    const sown = sownIntoStore(before[move]!, move, player);
    const captured = after[STORE[player]!]! - before[STORE[player]!]! - sown;
    if (captured > 1) {
      this.sfx.play("capture");
      await this.say(`${who} captured ${captured} stones!`);
    }
    if (extra) {
      this.sfx.play("extra");
      await this.say(player === this.human ? "Last stone in your store! Go again!" : "ROBOT landed in its store! It goes again!");
    }
  }

  /** Update the bars and face from a search score, and let the robot comment on mood swings. */
  private async react(value: number) {
    const p = winChance(value, 1 - this.human);
    this.setBars(p);
    const mood = moodFor(p);
    const changed = mood !== this.mood;
    this.setMood(mood);
    if (changed || Math.random() < 0.25) await this.say(`ROBOT: ${pick(LINES[mood]!)}`);
  }

  private async finish() {
    const L = this.layout();
    const me = this.state[L.bottomStore]!;
    const bot = this.state[L.topStore]!;
    const mood: Mood = bot > me ? "won" : bot < me ? "lost" : "draw";
    this.setMood(mood);
    this.setBars(mood === "won" ? 1 : mood === "lost" ? 0 : 0.5);
    this.sfx.play(mood === "lost" ? "win" : mood === "won" ? "lose" : "extra");
    await this.say("The board is cleared! Remaining stones go to their owners.");
    await this.say(`ROBOT: ${pick(LINES[mood]!)}`, true);
    // Save the result while the robot talks; the updated record is announced after.
    const saved = Promise.race([reportResult(this.level.key, bot, me), sleep(4000).then(() => null)]);
    await this.say(mood === "lost" ? `You won ${me} to ${bot}!` : mood === "won" ? `You lost ${me} to ${bot}...` : `It's a draw, ${me} to ${bot}!`, true);
    const id = this.session;
    const record = await saved;
    this.check(id);
    if (record) {
      this.record = Promise.resolve(record);
      await this.say(`ROBOT's record on ${LEVEL_NAMES[this.level.key]}: ${describeRecord(record[this.level.key])}.`, true);
    }
  }

  // ───────────────────────────── drawing ─────────────────────────────

  /** Board indices for each visual row (left → right), from the visitor's point of view. */
  private layout() {
    return this.human === MAX
      ? { bottom: [0, 1, 2, 3, 4, 5], bottomStore: 6, top: [12, 11, 10, 9, 8, 7], topStore: 13 }
      : { bottom: [7, 8, 9, 10, 11, 12], bottomStore: 13, top: [5, 4, 3, 2, 1, 0], topStore: 6 };
  }

  private resetBoard() {
    this.human = MAX;
    this.state = [...CLASSIC];
    this.lastMove = -1;
    this.el.lv.textContent = "Lv??";
    this.el.stats.textContent = "";
    this.el.text.textContent = "";
    this.setMood("idle");
    this.setBars(0.5);
    this.render();
  }

  private render() {
    const L = this.layout();
    const choice = this.pitChoice;
    const cursor = choice ? choice.legal[choice.index] : -1;
    const pit = (idx: number, mine: boolean, n: number) => {
      const el = document.createElement(mine ? "button" : "div");
      el.className = "gb__pit";
      el.classList.toggle("is-last", idx === this.lastMove);
      el.classList.toggle("is-hot", idx === this.hot);
      el.classList.toggle("is-flash", this.flash.has(idx));
      el.append(stones(this.state[idx]!), Object.assign(document.createElement("span"), { className: "gb__count", textContent: String(this.state[idx]) }));
      if (el instanceof HTMLButtonElement) {
        el.type = "button";
        const legal = !!choice?.legal.includes(idx);
        el.disabled = !legal;
        el.classList.toggle("is-cursor", idx === cursor);
        el.setAttribute("aria-label", `Your pit ${n}: ${this.state[idx]} stones`);
        el.addEventListener("click", () => this.pickPit(idx));
      } else {
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", `Robot pit ${n}: ${this.state[idx]} stones`);
      }
      return el;
    };
    this.el.rows.bottom.replaceChildren(...L.bottom.map((idx, i) => pit(idx, true, i + 1)));
    this.el.rows.top.replaceChildren(...L.top.map((idx, i) => pit(idx, false, 6 - i)));
    for (const [key, idx] of [["top", L.topStore], ["bottom", L.bottomStore]] as const) {
      const store = this.el.stores[key];
      store.textContent = String(this.state[idx]);
      store.classList.toggle("is-hot", idx === this.hot);
      store.classList.toggle("is-flash", this.flash.has(idx));
    }
  }

  private setBars(robotChance: number) {
    const set = (bar: HTMLElement, pct: HTMLElement, p: number) => {
      bar.style.width = `${Math.round(p * 100)}%`;
      bar.dataset.level = p >= 0.5 ? "high" : p > 0.2 ? "mid" : "low";
      pct.textContent = `${Math.round(p * 100)}%`;
    };
    set(this.el.bars.foe, this.el.pcts.foe, robotChance);
    set(this.el.bars.me, this.el.pcts.me, 1 - robotChance);
  }

  private setMood(mood: Mood) {
    this.mood = mood;
    this.el.foe.dataset.mood = mood;
    drawRobot(this.robotCtx, mood);
  }

  private setThinking(on: boolean) {
    clearInterval(this.blink);
    if (!on) {
      drawRobot(this.robotCtx, this.mood);
      this.el.foe.dataset.mood = this.mood;
      return;
    }
    this.el.foe.dataset.mood = "thinking";
    let lit = true;
    drawRobot(this.robotCtx, "thinking");
    this.blink = window.setInterval(() => drawRobot(this.robotCtx, "thinking", (lit = !lit)), 300);
  }
}

function stones(n: number) {
  const wrap = document.createElement("span");
  wrap.className = "gb__stones";
  wrap.setAttribute("aria-hidden", "true");
  for (let i = 0; i < Math.min(n, 12); i++) wrap.append(document.createElement("i"));
  return wrap;
}

/** How many of `n` stones sown from `move` land in the mover's own store (it can be passed more than once). */
function sownIntoStore(n: number, move: number, player: number) {
  const own = STORE[player]!;
  const skip = STORE[1 - player]!;
  let count = 0;
  for (let pos = move; n > 0; ) {
    pos = (pos + 1) % 14;
    if (pos === skip) continue;
    if (pos === own) count++;
    n--;
  }
  return count;
}

const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n).toUpperCase();

/** The robot's record as a retro table, for the RECORD window. */
function recordTable(record: MancalaRecord | null): HTMLElement {
  if (!record) {
    return Object.assign(document.createElement("p"), { textContent: "The scoreboard is on the fritz right now. Try again later!" });
  }
  const table = document.createElement("table");
  table.className = "gb__table";
  const row = (cells: (string | number)[], tag: "th" | "td") => {
    const tr = document.createElement("tr");
    for (const c of cells) tr.append(Object.assign(document.createElement(tag), { textContent: String(c) }));
    return tr;
  };
  const caption = Object.assign(document.createElement("caption"), { textContent: "ROBOT vs. EVERY CHALLENGER" });
  const head = document.createElement("thead");
  head.append(row(["", "PLAYED", "WON", "LOST", "DRAW"], "th"));
  const body = document.createElement("tbody");
  for (const l of LEVELS) {
    const r = record[l.key];
    body.append(row([l.label, r.played, r.won, r.lost, r.draw], "td"));
  }
  table.append(caption, head, body);
  return table;
}
