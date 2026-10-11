/**
 * The town's weather: real weather in Dan's city (GET /api/weather), drawn as a wash folded into the
 * time-of-day tint, plus falling rain or snow, banks of fog, and the odd lightning flash.
 * `?weather=rain` in the URL forces it, for trying out each kind.
 */
import type { Weather } from "@dan-town/api/types";

const KINDS: readonly Weather[] = ["clear", "clouds", "fog", "rain", "storm", "snow"];

/** A `weather=` query parameter, or null if it's missing or not a known kind. */
export function parseWeatherParam(search: string): Weather | null {
  const w = new URLSearchParams(search).get("weather");
  return KINDS.includes(w as Weather) ? (w as Weather) : null;
}

export const forcedWeather = typeof location === "undefined" ? null : parseWeatherParam(location.search);

let current: Weather | null = forcedWeather;
export const currentWeather = () => current;
export const setCurrentWeather = (w: Weather | null) => {
  current = forcedWeather ?? w;
};

/** The wash each kind of weather lays over the town, on top of the time-of-day tint (see mixWashes). */
export const WEATHER_WASH: Record<Weather, string | null> = {
  clear: null,
  clouds: "rgba(90, 100, 120, 0.18)",
  fog: "rgba(220, 225, 232, 0.30)",
  rain: "rgba(60, 80, 120, 0.22)",
  storm: "rgba(30, 35, 60, 0.32)",
  snow: "rgba(235, 245, 255, 0.20)",
};

const parseRgba = (c: string) => {
  const [r, g, b, a] = c.match(/[\d.]+/g)!.map(Number);
  return { r: r!, g: g!, b: b!, a: a! };
};

/** One wash equal to painting `under` and then `over` (null is no wash). */
export function mixWashes(under: string | null, over: string | null): string | null {
  if (!under || !over) return under ?? over;
  const u = parseRgba(under);
  const o = parseRgba(over);
  const a = 1 - (1 - u.a) * (1 - o.a);
  const ch = (cu: number, co: number) => Math.round((co * o.a + cu * u.a * (1 - o.a)) / a);
  return `rgba(${ch(u.r, o.r)}, ${ch(u.g, o.g)}, ${ch(u.b, o.b)}, ${Number(a.toFixed(3))})`;
}

/** Falling weather needs a repaint every frame; the rest is still. */
export const animated = (w: Weather | null) => w === "rain" || w === "storm" || w === "snow";

/** Weather frames are a fifth of a second apart: smooth enough for pixel rain, light on the CPU. */
export const WEATHER_FRAME_MS = 200;
const RAIN_COUNT = 90;
const SNOW_COUNT = 60;
/** Lightning lights one frame in this many: one flash every nine seconds, far below three a second. */
const FLASH_EVERY = 45;

function rand(i: number, salt: number) {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Where particle `i` is at time `t` (ms) inside a `w`×`h` view, written into `out` so a frame allocates
 * nothing. Rain falls fast and slants; snow drifts down and sways.
 */
export function particleAt(i: number, t: number, kind: "rain" | "snow", w: number, h: number, out: { x: number; y: number }) {
  const rain = kind === "rain";
  const speed = (rain ? 0.12 : 0.015) * (0.7 + rand(i, 3) * 0.6);
  const y = (((rand(i, 2) * h + t * speed) % h) + h) % h;
  const sway = rain ? y * 0.25 : Math.sin(t / 900 + rand(i, 4) * Math.PI * 2) * 2;
  out.x = (((rand(i, 1) * w + sway) % w) + w) % w;
  out.y = y;
  return out;
}

export const flashOn = (t: number) => Math.floor(t / WEATHER_FRAME_MS) % FLASH_EVERY === 0;

const spot = { x: 0, y: 0 };

/**
 * Weather over the visible part of the town, `view` in world pixels. With `still` (reduced motion) it
 * draws one frozen frame and never flashes.
 */
export function drawWeather(
  ctx: CanvasRenderingContext2D,
  w: Weather | null,
  now: number,
  view: { x: number; y: number; w: number; h: number },
  still: boolean,
) {
  const t = still ? 0 : now;
  if (w === "rain" || w === "storm") {
    ctx.fillStyle = "rgba(210, 225, 255, 0.45)";
    for (let i = 0; i < RAIN_COUNT; i++) {
      particleAt(i, t, "rain", view.w, view.h, spot);
      ctx.fillRect(Math.floor(view.x + spot.x), Math.floor(view.y + spot.y), 1, 4);
    }
    if (w === "storm" && !still && flashOn(now)) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(view.x, view.y, view.w, view.h);
    }
  } else if (w === "snow") {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < SNOW_COUNT; i++) {
      particleAt(i, t, "snow", view.w, view.h, spot);
      const size = i % 3 === 0 ? 2 : 1;
      ctx.fillRect(Math.floor(view.x + spot.x), Math.floor(view.y + spot.y), size, size);
    }
  } else if (w === "fog") {
    // Still banks of mist: fog isn't animated, so these stay put between repaints.
    ctx.fillStyle = "rgba(235, 238, 242, 0.14)";
    for (let b = 0; b < 3; b++) ctx.fillRect(view.x, Math.floor(view.y + view.h * (0.25 + b * 0.25)), view.w, Math.ceil(view.h * 0.12));
  }
}
