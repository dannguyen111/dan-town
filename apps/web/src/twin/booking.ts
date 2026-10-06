/**
 * Meeting slots in the chat: the twin's offered times as buttons, and the small form a visitor
 * fills in to request one. The form posts straight to /api/twin/book, so the AI never sees the
 * visitor's name or email.
 */
import type { BookingRequestBody, Slot } from "@dan-town/api/types";
import { slotLabel } from "./events.ts";
import { turnstileToken } from "./turnstile.ts";

const KIND: Record<Slot["duration"], string> = { 15: "15-min intro", 30: "30-min chat" };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function slotText(slot: Slot): string {
  const { main, et } = slotLabel(slot);
  return `${main}${et ? ` (${et})` : ""}`;
}

/** The buttons under a twin reply. Picking one opens the request form below them. */
export function renderSlots(slots: Slot[], opts: { first: string; tz: string; turnstile: HTMLElement }): HTMLElement {
  const wrap = el("div", { className: "slots" });
  const list = el("ul", { className: "clean chips" });
  wrap.append(el("p", { className: "muted slots__label" }, slots.length > 1 ? "Pick a time to request it:" : "Request this time:"), list);
  for (const slot of slots) {
    const { main, et } = slotLabel(slot);
    const button = el("button", { type: "button", className: "chip suggestion slot" }, el("span", {}, main));
    if (et) button.append(el("span", { className: "slot__et" }, `${et}`));
    if (slot.custom) button.title = `Outside ${opts.first}'s usual hours, so ${opts.first} will confirm whether it works.`;
    button.addEventListener("click", () => {
      wrap.querySelectorAll<HTMLButtonElement>(".slot").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      wrap.querySelector("form")?.remove();
      const form = bookingForm(slot, opts, () => wrap.querySelectorAll<HTMLButtonElement>(".slot").forEach((b) => (b.disabled = true)));
      wrap.append(form);
      form.querySelector<HTMLInputElement>("input[name=name]")?.focus();
      form.scrollIntoView({ block: "nearest" });
    });
    list.append(el("li", {}, button));
  }
  return wrap;
}

function bookingForm(slot: Slot, opts: { first: string; tz: string; turnstile: HTMLElement }, onSent: () => void): HTMLFormElement {
  const { first } = opts;
  const field = (label: string, input: HTMLInputElement | HTMLTextAreaElement) => el("label", { className: "book__field" }, el("span", {}, label), input);
  const name = el("input", { name: "name", required: true, maxLength: 80, autocomplete: "name" });
  const email = el("input", { name: "email", type: "email", required: true, maxLength: 254, autocomplete: "email" });
  const topic = el("textarea", { name: "topic", rows: 2, maxLength: 300, placeholder: "Recruiting, a project, just saying hi…" });
  // Honeypot: hidden from people, tempting for bots.
  const website = el("input", { name: "website", tabIndex: -1, autocomplete: "off", className: "visually-hidden" });
  website.setAttribute("aria-hidden", "true");
  const submit = el("button", { type: "submit", className: "btn btn--teal btn--small" }, "Send request");
  const cancel = el("button", { type: "button", className: "btn btn--small" }, "Cancel");
  const status = el("p", { className: "book__status", role: "status" });

  const form = el(
    "form",
    { className: "book" },
    el("p", { className: "book__title" }, el("strong", {}, KIND[slot.duration]), ` · ${slotText(slot)}`),
    field("Your name", name),
    field("Email (for the calendar invite)", email),
    field("What's it about? (optional)", topic),
    website,
    el("div", { className: "book__actions" }, cancel, submit),
    status,
    el(
      "p",
      { className: "muted fine" },
      `This goes to ${first}, not the AI. Nothing is booked until ${first} approves it, and then you'll get a Google Calendar invite with a Meet link. Your details are deleted if it's declined, and 30 days after the meeting.`,
    ),
  );

  cancel.addEventListener("click", () => {
    form.closest(".slots")?.querySelectorAll(".slot").forEach((b) => b.removeAttribute("aria-pressed"));
    form.remove();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submit.disabled = true;
    status.className = "book__status";
    status.textContent = "Sending…";
    try {
      const body: BookingRequestBody = {
        start: slot.start,
        duration: slot.duration,
        name: name.value,
        email: email.value,
        topic: topic.value,
        tz: opts.tz,
        website: website.value,
        turnstileToken: await turnstileToken(opts.turnstile),
      };
      const res = await fetch("/api/twin/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error ?? "That didn't go through. Try again?");
      onSent();
      form.replaceWith(
        el(
          "p",
          { className: "book__done", role: "status" },
          `📨 Sent to ${first} for approval: ${KIND[slot.duration]}, ${slotText(slot)}. If it works, a Google Calendar invite will arrive at ${email.value}.`,
        ),
      );
    } catch (err) {
      status.className = "book__status book__status--error";
      status.textContent = err instanceof Error ? err.message : String(err);
      submit.disabled = false;
    }
  });
  return form;
}
