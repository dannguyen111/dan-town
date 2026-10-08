/**
 * The request line at the DJ booth: a visitor finds a song, adds a note, and calls it in. Requests go
 * to Dan by email first (workers/api/src/requests.ts); approved ones go up on the board.
 */
import type { SearchTrack, SongRequest } from "@dan-town/api/types";
import { h } from "../lib/stats-client";
import { turnstileToken } from "../twin/turnstile";
import { picker, sleeve } from "./search";

/** The chalkboard of approved requests. */
async function loadBoard(list: HTMLElement) {
  try {
    const res = await fetch("/api/requests");
    const board = res.ok ? ((await res.json()) as SongRequest[]) : [];
    list.replaceChildren(
      ...(board.length
        ? board.map((r) =>
            h(
              "li",
              { class: "chalk" },
              h("a", { href: r.track.url, target: "_blank", rel: "noopener noreferrer", class: "chalk__song" }, `${r.track.name} — ${r.track.artists}`),
              r.note || r.name ? h("p", { class: "chalk__note" }, r.note ? `“${r.note}”` : "", r.name ? h("span", {}, ` — ${r.name}`) : "") : "",
            ),
          )
        : [h("li", { class: "chalk chalk--empty" }, "No requests on the board yet. Be the first.")]),
    );
  } catch {
    list.replaceChildren(h("li", { class: "chalk chalk--empty" }, "The board is being wiped. Check back soon."));
  }
}

export function setupRequests(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>("[data-request-form]")!;
  const input = root.querySelector<HTMLInputElement>("[data-request-search]")!;
  const results = root.querySelector<HTMLElement>("[data-request-results]")!;
  const chosen = root.querySelector<HTMLElement>("[data-request-chosen]")!;
  const status = root.querySelector<HTMLElement>("[data-request-status]")!;
  const send = root.querySelector<HTMLButtonElement>("[data-request-send]")!;
  const board = root.querySelector<HTMLElement>("[data-request-board]")!;
  const turnstile = root.querySelector<HTMLElement>("[data-request-turnstile]")!;

  let track: SearchTrack | null = null;

  const showChosen = () => {
    if (!track) {
      chosen.replaceChildren();
      chosen.hidden = true;
      input.hidden = false;
      return;
    }
    const change = h("button", { type: "button", class: "chip-x", "aria-label": "Pick a different song" }, "✕");
    change.addEventListener("click", () => {
      track = null;
      showChosen();
      input.focus();
    });
    chosen.replaceChildren(sleeve(track.image, "pick__art"), h("span", { class: "pick__text" }, h("span", { class: "pick__name" }, track.name), h("span", { class: "pick__sub" }, track.artists)), change);
    chosen.hidden = false;
    input.hidden = true;
  };

  picker("track", input, results, status, (t) => {
    track = t;
    status.textContent = "";
    showChosen();
    form.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!track) {
      status.textContent = "Find a song first.";
      input.focus();
      return;
    }
    const data = new FormData(form);
    const value = (k: string) => String(data.get(k) ?? "").trim();
    send.disabled = true;
    status.textContent = "Dialing the booth…";
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id, note: value("note"), name: value("name"), website: value("website"), turnstileToken: await turnstileToken(turnstile) }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "The line's busy. Try again?");
      status.textContent = `📞 Called in! "${track.name}" goes on the board once it's approved.`;
      form.reset();
      track = null;
      showChosen();
    } catch (err) {
      status.textContent = (err as Error).message;
    } finally {
      send.disabled = false;
    }
  });

  showChosen();
  void loadBoard(board);
}
