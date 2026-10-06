import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env.ts";
import type { Booking } from "./booking-store.ts";

vi.mock("./generated/twin-context.ts", () => ({
  TWIN_NAME: "Dan Test",
  TWIN_VOICE: "Friendly.",
  TWIN_CONTEXT: "# Dan Test",
  INTEGRATIONS: { github: { username: null }, leetcode: { username: null }, spotify: { enabled: false } },
}));

const { handleBooking, handleBookingModerate, parseBookingRequest, renderBookingNotification } = await import("./booking.ts");
const { HttpError } = await import("./twin.ts");
const { resetTokenCache } = await import("./gcal.ts");
const { sign } = await import("./sign.ts");

// Monday, Oct 5 2026, 8:00 AM EDT. Wednesday 10 AM EDT is a core-hours slot.
const NOW = Date.parse("2026-10-05T12:00:00Z");
const WED_10 = "2026-10-07T14:00:00.000Z";
const SECRET = "booking-secret";

/** An in-memory stand-in for the BookingStore Durable Object, with the same rules. */
function fakeStore() {
  const rows = new Map<string, Booking>();
  return {
    rows,
    add: vi.fn(async (b: Omit<Booking, "status" | "eventLink">, caps: { perVisitor: number; perDay: number }) => {
      const all = [...rows.values()];
      if (all.filter((r) => r.ipHash === b.ipHash).length >= caps.perVisitor) return { ok: false, reason: "visitor_cap" };
      if (all.some((r) => ["pending", "approving", "approved"].includes(r.status) && r.start < b.end && r.end > b.start)) return { ok: false, reason: "taken" };
      const booking = { ...b, status: "pending", eventLink: "" } as Booking;
      rows.set(b.id, booking);
      return { ok: true, booking };
    }),
    get: async (id: string) => rows.get(id) ?? null,
    claim: async (id: string) => {
      const b = rows.get(id);
      if (b?.status !== "pending") return null;
      b.status = "approving";
      return b;
    },
    release: vi.fn(async (id: string) => {
      const b = rows.get(id);
      if (b?.status === "approving") b.status = "pending";
    }),
    approve: vi.fn(async (id: string, link: string) => Object.assign(rows.get(id)!, { status: "approved", eventLink: link })),
    decline: vi.fn(async (id: string) => Object.assign(rows.get(id)!, { status: "declined", name: "", email: "", topic: "" })),
  };
}

let store: ReturnType<typeof fakeStore>;
let send: ReturnType<typeof vi.fn>;
let busy: { start: string; end: string }[];
let calls: { url: string; body: any }[];

function makeEnv(over: Partial<Env> = {}): Env {
  return {
    SITE_URL: "https://si-dan.com",
    GOOGLE_CLIENT_ID: "cid",
    GOOGLE_CLIENT_SECRET: "csecret",
    GOOGLE_REFRESH_TOKEN: "refresh",
    BOOKING_SECRET: SECRET,
    FRIDGE_NOTIFY_TO: "dan@example.com",
    FRIDGE_MAIL: { send },
    TWIN_LIMITER: { limit: async () => ({ success: true }) },
    BOOKING: { idFromName: () => "id", get: () => store },
    ...over,
  } as unknown as Env;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  resetTokenCache();
  store = fakeStore();
  send = vi.fn(async () => {});
  busy = [];
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : Object.fromEntries(new URLSearchParams(init.body as never));
      calls.push({ url, body });
      if (url.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ access_token: "at", expires_in: 3600 });
      if (url.endsWith("/freeBusy")) return Response.json({ calendars: { primary: { busy } } });
      if (url.includes("/events")) return Response.json({ id: "ev1", htmlLink: "https://calendar.google.com/event?eid=ev1", hangoutLink: "https://meet.google.com/abc" });
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const status = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof HttpError) return e.status;
    throw e;
  }
  return 200;
};

const valid = { start: WED_10, duration: 30, name: "Ana Lee", email: "ana@example.com", topic: "Internship chat", tz: "America/Chicago" };
const post = (body: unknown) =>
  new Request("https://si-dan.com/api/twin/book", { method: "POST", body: JSON.stringify(body), headers: { "CF-Connecting-IP": "203.0.113.9" } });
const ctx = () => {
  const pending: Promise<unknown>[] = [];
  return { pending, waitUntil: (p: Promise<unknown>) => void pending.push(p) };
};

describe("parseBookingRequest", () => {
  it("accepts a valid request and cleans it", () => {
    const r = parseBookingRequest({ ...valid, name: "  Ana Lee\u0007 ", tz: "Not/AZone" });
    expect(r).toMatchObject({ name: "Ana Lee", duration: 30, tz: "America/New_York", website: "" });
  });

  it.each([
    [{ ...valid, start: "tomorrow" }, 400],
    [{ ...valid, duration: 60 }, 400],
    [{ ...valid, name: "   " }, 400],
    [{ ...valid, email: "ana@example" }, 400],
    [{ ...valid, email: "ana@example.com\nBcc: x@y.z" }, 400],
    [{ ...valid, topic: "x".repeat(301) }, 413],
    [null, 400],
  ])("rejects %j with %i", async (body, code) => {
    expect(await status((async () => parseBookingRequest(body))())).toBe(code);
  });
});

describe("handleBooking", () => {
  it("re-checks the calendar, saves a pending request without the raw IP, and emails Dan signed links", async () => {
    const c = ctx();
    const out = await handleBooking(post(valid), makeEnv(), c);
    expect(out).toEqual({ ok: true, slot: expect.objectContaining({ start: WED_10, local: "Wed, Oct 7, 9:00 AM CDT" }) });

    const saved = [...store.rows.values()][0]!;
    expect(saved).toMatchObject({ status: "pending", kind: "core", name: "Ana Lee", start: Date.parse(WED_10), end: Date.parse(WED_10) + 30 * 60_000 });
    expect(saved.ipHash).toMatch(/^[0-9a-f]{24}$/);
    expect(JSON.stringify(saved)).not.toContain("203.0.113.9");
    expect(calls.find((x) => x.url.endsWith("/freeBusy"))!.body).toMatchObject({ timeMin: WED_10, items: [{ id: "primary" }] });

    await Promise.all(c.pending);
    const mail = send.mock.calls[0]![0];
    expect(mail).toMatchObject({ to: "dan@example.com", replyTo: "ana@example.com", from: { email: "twin@si-dan.com" } });
    expect(mail.subject).toContain("30-min chat request from Ana Lee");
    const approve = mail.text.match(/Approve.*?: (\S+)/)[1] as string;
    const u = new URL(approve);
    expect(u.pathname).toBe("/api/twin/booking/moderate");
    expect(u.searchParams.get("sig")).toBe(await sign(SECRET, "booking", saved.id, "approve"));
  });

  it("marks evening times the visitor proposed as custom", async () => {
    await handleBooking(post({ ...valid, start: "2026-10-07T23:30:00.000Z" }), makeEnv(), ctx());
    expect([...store.rows.values()][0]!.kind).toBe("custom");
  });

  it("refuses busy, out-of-hours and already-requested times", async () => {
    busy = [{ start: "2026-10-07T13:30:00Z", end: "2026-10-07T14:15:00Z" }];
    expect(await status(handleBooking(post(valid), makeEnv(), ctx()))).toBe(409);
    busy = [];
    expect(await status(handleBooking(post({ ...valid, start: "2026-10-10T14:00:00.000Z" }), makeEnv(), ctx()))).toBe(409); // Saturday
    expect(await status(handleBooking(post({ ...valid, start: "2026-10-05T18:00:00.000Z" }), makeEnv(), ctx()))).toBe(409); // under 24h
    await handleBooking(post(valid), makeEnv(), ctx());
    const other = new Request("https://si-dan.com/api/twin/book", { method: "POST", body: JSON.stringify(valid), headers: { "CF-Connecting-IP": "198.51.100.1" } });
    expect(await status(handleBooking(other, makeEnv(), ctx()))).toBe(409); // taken
  });

  it("caps each visitor at two requests", async () => {
    await handleBooking(post(valid), makeEnv(), ctx());
    await handleBooking(post({ ...valid, start: "2026-10-08T14:00:00.000Z" }), makeEnv(), ctx());
    expect(await status(handleBooking(post({ ...valid, start: "2026-10-09T14:00:00.000Z" }), makeEnv(), ctx()))).toBe(429);
  });

  it("quietly drops honeypot submissions and needs the calendar configured", async () => {
    expect((await handleBooking(post({ ...valid, website: "spam.example" }), makeEnv(), ctx())).ok).toBe(true);
    expect(store.add).not.toHaveBeenCalled();
    expect(await status(handleBooking(post(valid), makeEnv({ GOOGLE_REFRESH_TOKEN: undefined }), ctx()))).toBe(503);
  });
});

describe("renderBookingNotification", () => {
  it("escapes everything the visitor wrote", () => {
    const b = { id: "b1", start: Date.parse(WED_10), end: 0, duration: 15, tz: "America/New_York", kind: "core", name: "<img src=x>", email: "a@b.co", topic: '"><script>', status: "pending" } as Booking;
    const { html, subject } = renderBookingNotification(b, { approve: "https://x/a?x=1&y=2", decline: "https://x/d" });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("https://x/a?x=1&amp;y=2");
    expect(subject).toContain("15-min intro");
  });
});

describe("handleBookingModerate", () => {
  async function seed() {
    const c = ctx();
    await handleBooking(post(valid), makeEnv(), c);
    await Promise.all(c.pending); // Dan's notification
    return [...store.rows.values()][0]!;
  }
  const link = async (id: string, action: string, method = "GET", sig?: string) =>
    new Request(`https://si-dan.com/api/twin/booking/moderate?id=${id}&action=${action}&sig=${sig ?? (await sign(SECRET, "booking", id, action))}`, { method });

  it("rejects forged or cross-feature links", async () => {
    const b = await seed();
    expect((await handleBookingModerate(await link(b.id, "approve", "POST", "forged"), makeEnv())).status).toBe(403);
    const fridgeSig = await sign(SECRET, "fridge", b.id, "approve");
    expect((await handleBookingModerate(await link(b.id, "approve", "POST", fridgeSig), makeEnv())).status).toBe(403);
    expect(b.status).toBe("pending");
  });

  it("only confirms on GET, then approves on POST: event with Meet, invite emailed, single use", async () => {
    const b = await seed();
    const get = await handleBookingModerate(await link(b.id, "approve"), makeEnv());
    expect(get.status).toBe(200);
    expect(await get.text()).toContain("<form method=\"post\">");
    expect(b.status).toBe("pending");

    const res = await handleBookingModerate(await link(b.id, "approve", "POST"), makeEnv());
    expect(res.status).toBe(200);
    const ev = calls.find((x) => x.url.includes("/events"))!;
    expect(ev.url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all");
    expect(ev.body).toMatchObject({
      summary: "Dan × Ana Lee · 30-min chat",
      start: { dateTime: WED_10 },
      attendees: [{ email: "ana@example.com", displayName: "Ana Lee" }],
      conferenceData: { createRequest: { requestId: b.id, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    });
    expect(b.status).toBe("approved");

    expect((await handleBookingModerate(await link(b.id, "approve", "POST"), makeEnv())).status).toBe(409);
    expect(calls.filter((x) => x.url.includes("/events"))).toHaveLength(1);
  });

  it("doesn't create anything when Dan got busy in the meantime", async () => {
    const b = await seed();
    busy = [{ start: "2026-10-07T14:00:00Z", end: "2026-10-07T15:00:00Z" }];
    expect((await handleBookingModerate(await link(b.id, "approve", "POST"), makeEnv())).status).toBe(409);
    expect(calls.some((x) => x.url.includes("/events"))).toBe(false);
    expect(b.status).toBe("pending");
  });

  it("declines: tells the visitor and forgets their details", async () => {
    const b = await seed();
    send.mockClear();
    expect((await handleBookingModerate(await link(b.id, "decline", "POST"), makeEnv())).status).toBe(200);
    expect(send.mock.calls[0]![0]).toMatchObject({ to: "ana@example.com", subject: "About your meeting request with Dan" });
    expect(b).toMatchObject({ status: "declined", name: "", email: "", topic: "" });
  });
});
