/** Shared OpenRouter plumbing: auth + attribution headers, and one retry when the provider is busy. */
import type { Env } from "./env.ts";
import { TWIN_NAME } from "./generated/twin-context.ts";

export const OPENROUTER = "https://openrouter.ai/api/v1";

export interface OpenRouterOptions {
  /** Aborts the whole request, body included, so leave it unset for long streams. */
  timeoutMs?: number;
  title?: string;
}

const BUSY = new Set([429, 503, 529]);

export async function openrouter(env: Env, path: string, body: unknown, opts: OpenRouterOptions = {}): Promise<Response> {
  const call = () =>
    fetch(`${OPENROUTER}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.SITE_URL,
        "X-Title": opts.title ?? `${TWIN_NAME}'s Town`,
      },
      body: JSON.stringify(body),
      ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
    });
  let res = await call();
  if (BUSY.has(res.status)) {
    await new Promise((r) => setTimeout(r, 750));
    res = await call();
  }
  return res;
}
