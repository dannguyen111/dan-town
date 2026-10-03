import type { Stats } from "@dan-town/api/types";

let pending: Promise<Stats | null> | null = null;

/** Fetch cached live stats once per visit, and only when a page that shows them is opened. */
export function loadStats(): Promise<Stats | null> {
  pending ??= fetch("/api/stats", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? (r.json() as Promise<Stats>) : null))
    .catch(() => null);
  return pending;
}

export const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export function fmtUpdated(iso: string | null) {
  if (!iso) return "";
  return `Updated ${new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/** Tiny DOM helper: h("div", { class: "x" }, child, "text"). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) el.setAttribute(k, v);
  for (const c of children) if (c) el.append(c);
  return el;
}
