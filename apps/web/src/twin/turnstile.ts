/**
 * One Turnstile widget for the whole chat, loaded only when first needed. Each token is single-use:
 * `token()` hands out the current one and resets the widget for next time.
 */
const SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined;

let widget: { id?: string; token?: string; waiting?: (t: string) => void } = {};
const ts = () => (window as any).turnstile;

async function load() {
  if (ts()) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the human check. Try again?"));
    document.head.append(s);
  });
}

/** A fresh token, or undefined when Turnstile isn't configured for this build. */
export async function turnstileToken(container: HTMLElement): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;
  await load();
  const token = widget.token
    ? widget.token
    : await new Promise<string>((resolve) => {
        widget.waiting = resolve;
        if (widget.id !== undefined && container.isConnected && container.childElementCount) ts().reset(widget.id);
        else
          widget.id = ts().render(container, {
            sitekey: SITE_KEY,
            size: "flexible",
            callback: (t: string) => {
              widget.token = t;
              widget.waiting?.(t);
            },
          });
      });
  // Single use: the next call gets a new one.
  widget.token = undefined;
  return token;
}

/** Forget the widget (the page is being swapped out). */
export function resetTurnstile() {
  widget = {};
}
