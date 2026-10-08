/**
 * The search box for Crate & Closet's request line (songs) and Crate Match (artists): type, wait a
 * beat, pick from the list. Searches go through the site's API, never straight to Spotify.
 */
import type { SearchArtist, SearchTrack } from "@dan-town/api/types";
import { h } from "../lib/stats-client";

type Found<T extends "track" | "artist"> = T extends "track" ? SearchTrack : SearchArtist;

export async function search<T extends "track" | "artist">(type: T, q: string, signal?: AbortSignal): Promise<Found<T>[]> {
  const res = await fetch(`/api/spotify/search?${new URLSearchParams({ type, q })}`, { signal });
  const body = (await res.json().catch(() => ({}))) as { tracks?: SearchTrack[]; artists?: SearchArtist[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Search isn't working right now.");
  return ((type === "track" ? body.tracks : body.artists) ?? []) as Found<T>[];
}

export const sleeve = (src: string | null, cls = "pick__art") =>
  src ? h("img", { class: cls, src, alt: "", width: "40", height: "40", loading: "lazy" }) : h("span", { class: `${cls} ${cls}--empty`, "aria-hidden": "true" }, "♪");

/**
 * Wire a search input to a results list. `onPick` gets the chosen item; the list empties after a pick.
 * Returns a function that clears the box.
 */
export function picker<T extends "track" | "artist">(
  type: T,
  input: HTMLInputElement,
  list: HTMLElement,
  status: HTMLElement,
  onPick: (item: Found<T>) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: AbortController | null = null;

  const clear = () => {
    list.replaceChildren();
    input.setAttribute("aria-expanded", "false");
  };

  const run = async () => {
    const q = input.value.trim();
    inflight?.abort();
    if (q.length < 2) return clear();
    inflight = new AbortController();
    try {
      const found = await search(type, q, inflight.signal);
      list.replaceChildren(
        ...found.map((item) => {
          const it = item as SearchTrack | SearchArtist;
          const label = "artists" in it ? `${it.name} · ${it.artists}` : it.name;
          const b = h(
            "button",
            { type: "button", class: "pick", "aria-label": label },
            sleeve(it.image),
            h("span", { class: "pick__text" }, h("span", { class: "pick__name" }, it.name), "artists" in it ? h("span", { class: "pick__sub" }, it.artists) : ""),
          );
          b.addEventListener("click", () => {
            onPick(item);
            input.value = "";
            clear();
            input.focus();
          });
          return h("li", {}, b);
        }),
      );
      input.setAttribute("aria-expanded", String(found.length > 0));
      status.textContent = found.length ? "" : "Nothing found. Try another spelling?";
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      status.textContent = (err as Error).message;
    }
  };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 280);
  });
  input.addEventListener("keydown", (e) => {
    // Enter picks the first result instead of submitting the form.
    if (e.key === "Enter") {
      e.preventDefault();
      list.querySelector<HTMLButtonElement>(".pick")?.click();
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list.querySelector<HTMLButtonElement>(".pick")?.focus();
    }
  });
  list.addEventListener("keydown", (e) => {
    const picks = [...list.querySelectorAll<HTMLButtonElement>(".pick")];
    const i = picks.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" && i < picks.length - 1) {
      e.preventDefault();
      picks[i + 1]!.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      (i > 0 ? picks[i - 1]! : input).focus();
    } else if (e.key === "Escape") {
      clear();
      input.focus();
    }
  });
  return () => {
    input.value = "";
    clear();
  };
}
