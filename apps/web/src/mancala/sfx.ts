/**
 * 8-bit sound effects, synthesised with square waves so there are no audio files to load.
 * Muted by default; the visitor's choice is remembered in this browser.
 */

const KEY = "arcade-sound";
type Note = [freq: number, ms: number];

const SOUNDS = {
  blip: [[880, 18]],
  move: [[660, 40]],
  select: [[990, 50], [1320, 70]],
  back: [[440, 60]],
  drop: [[520, 45]],
  store: [[784, 60], [1046, 90]],
  capture: [[523, 70], [659, 70], [784, 70], [1046, 140]],
  extra: [[784, 80], [988, 80], [1175, 160]],
  win: [[523, 120], [659, 120], [784, 120], [1046, 120], [784, 100], [1046, 320]],
  lose: [[392, 180], [370, 180], [349, 180], [330, 420]],
  start: [[392, 90], [523, 90], [659, 90], [784, 200]],
} satisfies Record<string, Note[]>;

export type Sound = keyof typeof SOUNDS;

export class Sfx {
  private ctx: AudioContext | null = null;
  on = false;

  constructor() {
    try {
      this.on = localStorage.getItem(KEY) === "on";
    } catch {
      // Storage can be blocked; sound just stays off.
    }
  }

  toggle() {
    this.on = !this.on;
    try {
      localStorage.setItem(KEY, this.on ? "on" : "off");
    } catch {
      // Not persisted; fine.
    }
    if (this.on) this.play("select");
    return this.on;
  }

  /** `pitch` shifts the whole sound, e.g. to make each sown stone a little higher. */
  play(name: Sound, pitch = 1) {
    if (!this.on) return;
    // Browsers only allow audio after a user gesture; toggling sound on is one.
    this.ctx ??= new AudioContext();
    const ctx = this.ctx;
    if (ctx.state === "suspended") void ctx.resume();
    let t = ctx.currentTime;
    for (const [freq, ms] of SOUNDS[name] as Note[]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq * pitch;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + ms / 1000);
      t += ms / 1000;
    }
  }
}
