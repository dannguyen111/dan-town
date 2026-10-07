/** Zooming from an object in the room into its close-up (the TV, the desk). */

/** Where a room object is on screen right now. Town.astro answers "town:rect" synchronously. */
export function objectRect(id: string): DOMRect | null {
  let rect: DOMRect | null = null;
  document.dispatchEvent(new CustomEvent("town:rect", { detail: { id, reply: (r: DOMRect | null) => (rect = r) } }));
  return rect;
}

/** Grow `el` (already open) out of `from`, as if the camera moved in. A plain fade with reduced motion. */
export function zoomIn(el: HTMLElement, from: DOMRect | null) {
  if (!from || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
    return;
  }
  const to = el.getBoundingClientRect();
  const s = Math.max(0.05, Math.min(from.width / to.width, from.height / to.height));
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.3, filter: "brightness(0.6)" },
      { transform: "none", opacity: 1, filter: "brightness(1)" },
    ],
    { duration: 450, easing: "cubic-bezier(.2,.8,.2,1)" },
  );
}
