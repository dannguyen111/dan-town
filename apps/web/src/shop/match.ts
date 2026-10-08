/**
 * Crate Match, at the record crates: a visitor picks a few artists (or gives a Last.fm username) and
 * sees how close their taste is to Dan's, with a record picked for them. The score comes from
 * POST /api/match (workers/api/src/crate.ts). Nothing the visitor enters is stored; a result can be
 * shared as a link that runs the same match again, or saved as a PNG card.
 */
import type { MatchRequest, MatchResult, SearchArtist } from "@dan-town/api/types";
import { h } from "../lib/stats-client";
import { drawCard, toPng } from "./card";
import { picker, sleeve } from "./search";

const MAX = 5;

/** `?crate=SZA|Frank Ocean` or `?crate=lfm:username`, both ways. */
export const shareParam = (req: MatchRequest) => ("lastfm" in req ? `lfm:${req.lastfm}` : req.artists.join("|"));
export function fromShareParam(v: string | null): MatchRequest | null {
  if (!v) return null;
  if (v.startsWith("lfm:")) return v.length > 4 ? { lastfm: v.slice(4) } : null;
  const artists = v.split("|").map((a) => a.trim()).filter(Boolean).slice(0, MAX);
  return artists.length ? { artists } : null;
}

export interface MatchUi {
  /** Run a match straight away (a shared link). */
  run(req: MatchRequest): void;
}

/** Wire the Crate Match console. `play` drops a track into a player; `first` is Dan's first name. */
export function setupMatch(root: HTMLElement, opts: { first: string; site: string; play: (url: string, title: string, into: HTMLElement) => void }): MatchUi {
  const form = root.querySelector<HTMLFormElement>("[data-match-form]")!;
  const input = root.querySelector<HTMLInputElement>("[data-match-search]")!;
  const results = root.querySelector<HTMLElement>("[data-match-results]")!;
  const pickedList = root.querySelector<HTMLElement>("[data-match-picked]")!;
  const lastfm = root.querySelector<HTMLInputElement>("[data-match-lastfm]")!;
  const status = root.querySelector<HTMLElement>("[data-match-status]")!;
  const go = root.querySelector<HTMLButtonElement>("[data-match-go]")!;
  const out = root.querySelector<HTMLElement>("[data-match-result]")!;

  let picked: SearchArtist[] = [];
  let last: { req: MatchRequest; result: MatchResult } | null = null;

  const renderPicked = () => {
    pickedList.replaceChildren(
      ...picked.map((a) => {
        const remove = h("button", { type: "button", class: "chip-x", "aria-label": `Remove ${a.name}` }, "✕");
        remove.addEventListener("click", () => {
          picked = picked.filter((p) => p.id !== a.id);
          renderPicked();
        });
        return h("li", { class: "crate-chip" }, sleeve(a.image, "crate-chip__art"), h("span", {}, a.name), remove);
      }),
    );
    input.disabled = picked.length >= MAX;
    input.placeholder = picked.length >= MAX ? "That's a full crate" : picked.length ? "Add another…" : "Search an artist you love…";
  };

  picker("artist", input, results, status, (a) => {
    if (picked.length >= MAX || picked.some((p) => p.id === a.id)) return;
    picked = [...picked, a];
    renderPicked();
  });

  async function run(req: MatchRequest) {
    go.disabled = true;
    status.textContent = "Digging through the crates…";
    out.hidden = true;
    try {
      const res = await fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
      const body = (await res.json().catch(() => ({}))) as MatchResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "The crates are stuck. Try again?");
      last = { req, result: body };
      status.textContent = "";
      render(body);
    } catch (err) {
      status.textContent = (err as Error).message;
    } finally {
      go.disabled = false;
    }
  }

  function render(r: MatchResult) {
    const leds = h("div", { class: "meter", role: "img", "aria-label": `${r.score} out of 100` });
    for (let i = 0; i < 20; i++) leds.append(h("span", { class: i < Math.round(r.score / 5) ? (i < 12 ? "led led--on" : "led led--hot") : "led" }));

    const rows: HTMLElement[] = [];
    if (r.shared.length) rows.push(h("li", {}, h("span", { class: "match__label" }, "You both play"), h("span", {}, r.shared.join(" · "))));
    for (const n of r.neighbours.slice(0, 3))
      rows.push(h("li", {}, h("span", { class: "match__label" }, "Neighbours"), h("span", {}, `your ${n.yours} ↔ ${opts.first}'s ${n.mine}`)));
    if (r.sharedTags.length) rows.push(h("li", {}, h("span", { class: "match__label" }, "Shared sound"), h("span", {}, r.sharedTags.join(" · "))));
    if (!rows.length) rows.push(h("li", {}, h("span", {}, `No overlap yet. Opposites make the best mixtapes: try ${opts.first}'s pick below.`)));

    const deck = h("div", { class: "match__deck" });
    const pick = r.pick
      ? h(
          "div",
          { class: "match__pick" },
          h("p", { class: "match__label" }, `${opts.first} picked this for you`),
          h(
            "div",
            { class: "match__record" },
            sleeve(r.pick.image, "match__sleeve"),
            h("p", { class: "match__song" }, h("strong", {}, r.pick.name), h("span", {}, r.pick.artists), h("em", {}, r.pick.why)),
          ),
          deck,
        )
      : "";
    if (r.pick) {
      const drop = h("button", { type: "button", class: "mcp-btn mcp-btn--primary" }, "▶ Drop the needle");
      drop.addEventListener("click", () => opts.play(r.pick!.url, `${r.pick!.name} by ${r.pick!.artists}`, deck));
      deck.append(drop);
    }

    const save = h("button", { type: "button", class: "mcp-btn" }, "🖼️ Save card");
    save.addEventListener("click", async () => {
      const blob = await toPng(await drawCard(r, opts));
      if (!blob) return;
      const a = h("a", { href: URL.createObjectURL(blob), download: `crate-match-${r.score}.png` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    const copy = h("button", { type: "button", class: "mcp-btn" }, "🔗 Copy link");
    copy.addEventListener("click", async () => {
      const url = new URL("/music", location.origin);
      url.searchParams.set("crate", shareParam(last!.req));
      try {
        await navigator.clipboard.writeText(url.toString());
        copy.textContent = "✓ Copied";
      } catch {
        // No clipboard access: show the link, selected, so it can be copied by hand.
        const field = h("input", { class: "match__link", value: url.toString(), readonly: "", "aria-label": "Link to this match" });
        copy.replaceWith(field);
        field.select();
      }
    });
    const again = h("button", { type: "button", class: "mcp-btn" }, "💿 Dig again");
    again.addEventListener("click", () => {
      out.hidden = true;
      form.hidden = false;
      input.focus();
    });

    out.replaceChildren(
      h(
        "div",
        { class: "match__score" },
        h("p", { class: "match__pct", tabindex: "-1" }, `${r.score}%`),
        h("p", { class: "match__verdict" }, r.verdict),
        leds,
        h("p", { class: "match__by" }, r.by === "lastfm" ? "From your Last.fm listening, last six months." : "From the artists you picked."),
      ),
      h("ul", { class: "clean match__rows" }, ...rows),
      pick,
      h("p", { class: "match__actions" }, save, copy, again),
    );
    form.hidden = true;
    out.hidden = false;
    out.querySelector<HTMLElement>(".match__pct")?.focus();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = lastfm.value.trim();
    if (user) return void run({ lastfm: user });
    if (!picked.length) {
      status.textContent = "Pick at least one artist (three or more works best).";
      input.focus();
      return;
    }
    void run({ artists: picked.map((a) => a.name) });
  });

  renderPicked();
  return {
    run(req) {
      if ("artists" in req) {
        picked = req.artists.map((name, i) => ({ id: `shared-${i}`, name, image: null, url: "" }));
        renderPicked();
      } else lastfm.value = req.lastfm;
      void run(req);
    },
  };
}
