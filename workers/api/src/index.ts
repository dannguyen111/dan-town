import type { Env } from "./env.ts";
import { EMPTY_STATS, readStats, refreshIfEmpty, refreshStats } from "./stats.ts";
import { handleTwin, HttpError } from "./twin.ts";
import { handleMancalaResult, readMancalaRecord } from "./mancala.ts";
import { handleSpeak } from "./speak.ts";
import { handleBooking, handleBookingModerate } from "./booking.ts";
import { handleFridgeNote, handleModerate, readPinned } from "./fridge.ts";

export { MancalaRecordStore } from "./mancala-store.ts";
export { FridgeStore } from "./fridge-store.ts";
export { BookingStore } from "./booking-store.ts";

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), { ...init, headers: { "Content-Type": "application/json; charset=utf-8", ...init.headers } });

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/stats" && request.method === "GET") {
        const stats = await readStats(env);
        if (!stats) await refreshIfEmpty(env, ctx);
        // Browsers and the edge may reuse this for 30 minutes; the data changes once a day.
        return json(stats ?? EMPTY_STATS, { headers: { "Cache-Control": "public, max-age=1800" } });
      }
      if (url.pathname === "/api/twin" && request.method === "POST") {
        if (request.headers.get("Origin") && new URL(request.headers.get("Origin")!).host !== url.host) {
          throw new HttpError(403, "Cross-origin requests are not allowed.");
        }
        return await handleTwin(request, env, ctx);
      }
      if (url.pathname === "/api/twin/speak" && request.method === "POST") {
        if (request.headers.get("Origin") && new URL(request.headers.get("Origin")!).host !== url.host) {
          throw new HttpError(403, "Cross-origin requests are not allowed.");
        }
        return await handleSpeak(request, env);
      }
      if (url.pathname === "/api/twin/book" && request.method === "POST") {
        if (request.headers.get("Origin") && new URL(request.headers.get("Origin")!).host !== url.host) {
          throw new HttpError(403, "Cross-origin requests are not allowed.");
        }
        return json(await handleBooking(request, env, ctx), { headers: { "Cache-Control": "no-store" } });
      }
      // Signed approve/decline links from Dan's meeting-request emails. Serves its own small HTML page.
      if (url.pathname === "/api/twin/booking/moderate" && (request.method === "GET" || request.method === "POST")) {
        return await handleBookingModerate(request, env);
      }
      if (url.pathname === "/api/mancala") {
        if (request.method === "GET") return json(await readMancalaRecord(env), { headers: { "Cache-Control": "no-store" } });
        if (request.method === "POST") {
          if (request.headers.get("Origin") && new URL(request.headers.get("Origin")!).host !== url.host) {
            throw new HttpError(403, "Cross-origin requests are not allowed.");
          }
          return json(await handleMancalaResult(request, env), { headers: { "Cache-Control": "no-store" } });
        }
      }
      if (url.pathname === "/api/fridge") {
        // Pinned notes change only when Dan approves one, so a short cache is plenty.
        if (request.method === "GET") return json(await readPinned(env), { headers: { "Cache-Control": "public, max-age=60" } });
        if (request.method === "POST") {
          if (request.headers.get("Origin") && new URL(request.headers.get("Origin")!).host !== url.host) {
            throw new HttpError(403, "Cross-origin requests are not allowed.");
          }
          return json(await handleFridgeNote(request, env, ctx), { headers: { "Cache-Control": "no-store" } });
        }
      }
      // Signed approve/reject links from Dan's email. Serves its own small HTML page.
      if (url.pathname === "/api/fridge/moderate" && (request.method === "GET" || request.method === "POST")) {
        return await handleModerate(request, env);
      }
      if (url.pathname.startsWith("/api/")) throw new HttpError(404, "Not found.");
      return env.ASSETS.fetch(request);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
      console.error(err);
      return json({ error: "Something went wrong." }, { status: 500 });
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refreshStats(env));
  },
} satisfies ExportedHandler<Env>;
