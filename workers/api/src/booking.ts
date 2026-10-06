/**
 * Meeting requests from the twin chat.
 *
 * A visitor clicks a slot chip and fills in name, email and topic. That form posts here directly,
 * so the model never sees their details. Everything is re-checked server-side (the rules in
 * schedule.ts plus Google free/busy) and saved as "pending". Dan gets an email with signed
 * Approve/Decline links. Approving re-checks the calendar and creates the event with a Meet link,
 * and Google emails the invite. Nothing touches the calendar before Dan approves.
 */
import { z } from "zod";
import type { Env } from "./env.ts";
import type { Booking } from "./booking-store.ts";
import { TWIN_NAME } from "./generated/twin-context.ts";
import { CalendarError, calendarConfigured, createEvent, freeBusy } from "./gcal.ts";
import { mailButton, sendMail } from "./mail.ts";
import { page } from "./page.ts";
import { checkTime, ET, formatSlot, isTimeZone, MEETING_LABEL, REASON_TEXT, type Slot, toSlot } from "./schedule.ts";
import { hashIp, signedUrl, verify } from "./sign.ts";
import { clean, clientIp, escapeHtml, looksLikeEmail } from "./text.ts";
import { HttpError, verifyTurnstile } from "./twin.ts";

export const BOOKING_LIMITS = { name: 80, email: 254, topic: 300, perVisitor: 2, perDay: 20 } as const;
const MIN = 60_000;
const FIRST = TWIN_NAME.split(" ")[0]!;

const text = (max: number, label: string) =>
  z
    .string({ error: `${label} must be text.` })
    .transform(clean)
    .refine((s) => s.length <= max, `${label} is limited to ${max} characters.`);

export const BookingRequest = z.object({
  start: z.iso.datetime({ error: "Pick a time first." }),
  duration: z.union([z.literal(15), z.literal(30)], { error: "Meetings are 15 or 30 minutes." }),
  name: text(BOOKING_LIMITS.name, "Your name").refine((s) => s.length > 0, `Tell ${FIRST} your name.`),
  email: text(BOOKING_LIMITS.email, "Email").refine(looksLikeEmail, "That email address doesn't look right."),
  topic: text(BOOKING_LIMITS.topic, "Topic").default(""),
  tz: z.string().refine(isTimeZone).catch(ET),
  website: z.string().catch(""), // honeypot
  turnstileToken: z.string().optional().catch(undefined),
});
export type BookingRequest = z.infer<typeof BookingRequest>;

export function parseBookingRequest(body: unknown): BookingRequest {
  const parsed = BookingRequest.safeParse(body ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const tooLong = issue.message.includes("limited to");
    throw new HttpError(tooLong ? 413 : 400, issue.message);
  }
  return parsed.data;
}

const store = (env: Env) => env.BOOKING.get(env.BOOKING.idFromName("bookings"));

// ───────────────────────────── email to Dan ─────────────────────────────

export type BookingAction = "approve" | "decline";
const SCOPE = "booking";
const actionUrl = (env: Env, id: string, action: BookingAction) => signedUrl(env.SITE_URL, "/api/twin/booking/moderate", env.BOOKING_SECRET!, SCOPE, id, action);

const when = (b: Pick<Booking, "start" | "tz">) => {
  const et = formatSlot(b.start, ET);
  const local = formatSlot(b.start, b.tz);
  return local === et ? et : `${et} (their time: ${local})`;
};

/** The request email Dan receives. Pure, so it can be tested; every visitor string is escaped in the HTML. */
export function renderBookingNotification(b: Booking, links: Record<BookingAction, string>) {
  const label = MEETING_LABEL[b.duration as 15 | 30] ?? `${b.duration}-min meeting`;
  const custom = b.kind === "custom" ? "⚠️ Outside your usual 9–5: they proposed this time." : "";
  const subject = `📅 ${label} request from ${b.name}: ${formatSlot(b.start, ET)}`;
  const text = [
    `${b.name} <${b.email}> asked the twin for a ${label}.`,
    `When: ${when(b)}`,
    ...(custom ? [custom] : []),
    "",
    `Topic: ${b.topic || "(none given)"}`,
    "",
    `Approve (creates the event with a Google Meet link and emails them the invite): ${links.approve}`,
    `Decline: ${links.decline}`,
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#2b1d14">
  <p style="margin:0 0 4px"><strong>${escapeHtml(b.name)}</strong> · ${escapeHtml(b.email)}</p>
  <p style="margin:0 0 12px">${escapeHtml(label)} · <strong>${escapeHtml(when(b))}</strong></p>
  ${custom ? `<p style="padding:10px;background:#fff1d6;border:2px solid #c88a2b;border-radius:6px">${escapeHtml(custom)}</p>` : ""}
  <div style="white-space:pre-wrap;padding:14px;background:#f8f8f0;border:2px solid #2b1d14;border-radius:4px">${escapeHtml(b.topic || "(no topic given)")}</div>
  <p>${mailButton(escapeHtml(links.approve), "✅ Approve & send invite", "#bfe3d6")}${mailButton(escapeHtml(links.decline), "Decline", "#f8f8f0")}</p>
  <p style="font-size:13px;color:#7a6a5a">Approving re-checks your calendar first. Nothing is on your calendar until you approve.</p>
</div>`;
  return { subject, text, html };
}

async function notifyDan(env: Env, b: Booking) {
  const links = { approve: await actionUrl(env, b.id, "approve"), decline: await actionUrl(env, b.id, "decline") };
  await sendMail(env, { from: { name: `${FIRST}'s Digital Twin`, local: "twin" }, replyTo: b.email, ...renderBookingNotification(b, links) });
}

/** A short, kind note to the visitor when Dan declines. Best effort. */
export function renderDeclineNote(b: Booking) {
  const subject = `About your meeting request with ${FIRST}`;
  const body = `Hi ${b.name},\n\nThanks for reaching out through my site! Unfortunately ${formatSlot(b.start, b.tz)} doesn't work for me. Feel free to ask my digital twin for another time.\n\n${FIRST}`;
  return { subject, text: body, html: `<div style="font-family:system-ui,sans-serif;max-width:560px;white-space:pre-wrap">${escapeHtml(body)}</div>` };
}

// ───────────────────────────── request ─────────────────────────────

export async function handleBooking(request: Request, env: Env, ctx: Pick<ExecutionContext, "waitUntil">): Promise<{ ok: true; slot: Slot }> {
  if (!calendarConfigured(env) || !env.BOOKING_SECRET) throw new HttpError(503, `Meeting requests aren't set up yet. Email ${FIRST} instead!`);
  const ip = clientIp(request);
  const { success } = await env.TWIN_LIMITER.limit({ key: ip });
  if (!success) throw new HttpError(429, "Slow down a little! Try again in a minute.");

  const req = parseBookingRequest(await request.json().catch(() => null));
  const start = Date.parse(req.start);
  const slot = toSlot(start, req.duration, req.tz);
  // Honeypot: people never see this field. Look successful so the bot moves on.
  if (req.website) return { ok: true, slot };
  await verifyTurnstile(env, req.turnstileToken, ip);

  const end = start + req.duration * MIN;
  const now = Date.now();
  const busy = await freeBusy(env, start, end).catch((err) => {
    console.error("[booking] free/busy failed:", err instanceof Error ? err.message : err);
    throw new HttpError(503, `I can't check ${FIRST}'s calendar right now. Try again soon.`);
  });
  const check = checkTime(start, req.duration, busy, now);
  if (!check.ok) throw new HttpError(409, `${REASON_TEXT[check.reason]} Ask me for another time.`);

  const added = await store(env).add(
    {
      id: crypto.randomUUID(),
      createdAt: now,
      ipHash: await hashIp(env.BOOKING_SECRET, ip),
      start,
      end,
      duration: req.duration,
      tz: req.tz,
      kind: check.kind,
      name: req.name,
      email: req.email,
      topic: req.topic,
    },
    { perVisitor: BOOKING_LIMITS.perVisitor, perDay: BOOKING_LIMITS.perDay },
  );
  if (!added.ok) {
    if (added.reason === "taken") throw new HttpError(409, "Someone just asked for that time. Pick another one?");
    throw new HttpError(429, added.reason === "visitor_cap" ? `You've already sent ${FIRST} a couple of requests today. You'll hear back soon!` : `${FIRST} has lots of requests today. Try again tomorrow, or send an email.`);
  }
  ctx.waitUntil(notifyDan(env, added.booking).catch((err) => console.error("[booking] notification failed:", err instanceof Error ? err.message : err)));
  return { ok: true, slot };
}

// ───────────────────────────── approve / decline ─────────────────────────────

const ACTIONS: BookingAction[] = ["approve", "decline"];

const summary = (b: Booking) =>
  `<p><strong>${escapeHtml(b.name || "(details removed)")}</strong>${b.email ? ` · ${escapeHtml(b.email)}` : ""}</p><p>${escapeHtml(MEETING_LABEL[b.duration as 15 | 30] ?? "")} · ${escapeHtml(when(b))}</p>${b.topic ? `<div class="note">${escapeHtml(b.topic)}</div>` : ""}`;

/**
 * The links in Dan's email. GET only shows a confirmation with a button; the change happens on
 * POST, so mail scanners that prefetch links can't approve or decline anything. Each link works
 * once: the request must still be pending.
 */
export async function handleBookingModerate(request: Request, env: Env): Promise<Response> {
  if (!env.BOOKING_SECRET) return page("Not configured", "<p>Set the <code>BOOKING_SECRET</code> secret first.</p>", 503);
  const url = new URL(request.url);
  const id = url.searchParams.get("id") ?? "";
  const action = url.searchParams.get("action") as BookingAction;
  const sig = url.searchParams.get("sig") ?? "";
  if (!ACTIONS.includes(action) || !(await verify(env.BOOKING_SECRET, SCOPE, id, action, sig))) {
    return page("Link not valid", "<p>This link is broken or was tampered with.</p>", 403);
  }

  const bookings = store(env);
  const b = await bookings.get(id);
  if (!b) return page("Request not found", "<p>This request no longer exists.</p>", 404);
  if (b.status !== "pending") return page(`Already ${b.status}`, `${summary(b)}<p class="muted">Nothing to do: this request is ${escapeHtml(b.status)}.</p>`, 409);
  if (b.start <= Date.now()) return page("Too late", `${summary(b)}<p class="muted">This time has already passed.</p>`, 409);

  if (request.method !== "POST") {
    return page(
      action === "approve" ? "Approve this meeting?" : "Decline this request?",
      `${summary(b)}${action === "approve" ? `<p class="muted">Approving checks your calendar again, then creates the event with a Google Meet link and emails ${escapeHtml(b.name)} the invite.</p>` : `<p class="muted">They'll get a short note saying the time doesn't work. Their details are then deleted.</p>`}
<form method="post"><button type="submit">${action === "approve" ? "✅ Approve & send invite" : "Decline"}</button></form>`,
    );
  }

  if (action === "decline") {
    try {
      await sendMail(env, { from: { name: FIRST, local: "twin" }, to: b.email, ...renderDeclineNote(b) });
    } catch (err) {
      console.error("[booking] decline note failed:", err instanceof Error ? err.message : err);
    }
    await bookings.decline(id);
    return page("Declined", "<p>Done. They've been told, and their details are deleted.</p>");
  }

  const claimed = await bookings.claim(id);
  if (!claimed) return page("Already handled", "<p>This request was just handled in another tab.</p>", 409);
  try {
    const busy = await freeBusy(env, b.start, b.end);
    if (busy.length) {
      await bookings.release(id);
      return page(
        "You're busy then now",
        `${summary(b)}<p>Something else is on your calendar at that time now, so nothing was created. Decline it from the email, or free the time and approve again.</p>`,
        409,
      );
    }
    const event = await createEvent(env, {
      requestId: b.id,
      start: b.start,
      end: b.end,
      summary: `${FIRST} × ${b.name} · ${MEETING_LABEL[b.duration as 15 | 30] ?? "Meeting"}`,
      description: `${b.topic ? `${b.topic}\n\n` : ""}Requested through ${FIRST}'s digital twin on ${new URL(env.SITE_URL).hostname}.`,
      attendee: { email: b.email, name: b.name },
    });
    await bookings.approve(id, event.htmlLink);
    return page(
      "✅ Approved",
      `${summary(b)}<p>The event is on your calendar${event.hangoutLink ? " with a Google Meet link" : ""}, and Google emailed ${escapeHtml(b.name)} the invite.</p><p><a href="${escapeHtml(event.htmlLink)}">Open in Google Calendar</a></p>`,
    );
  } catch (err) {
    await bookings.release(id);
    console.error("[booking] approve failed:", err instanceof Error ? err.message : err);
    const status = err instanceof CalendarError && err.status === 401 ? "Google sign-in expired: run scripts/google-auth.mjs again." : "Google Calendar didn't respond.";
    return page("Couldn't create the event", `<p>${escapeHtml(status)} The request is still pending, so you can try the link again.</p>`, 502);
  }
}
