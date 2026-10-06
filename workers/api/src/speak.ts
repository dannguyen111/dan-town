/**
 * The twin's voice: one sentence of a reply in, MP3 out, through OpenRouter's speech API
 * (Kokoro-82M by default, ~$0.62 per million characters).
 *
 * The browser calls this once per sentence while a reply streams in, so the first words play
 * before the reply has finished. There's no Turnstile here (it would mean a challenge per
 * sentence). Instead each call is capped at SPEAK_LIMITS.chars, per-IP rate-limited, and
 * same-origin only. At Kokoro's price, sustained abuse costs cents a day.
 */
import type { Env } from "./env.ts";
import { openrouter } from "./openrouter.ts";
import { clean, clientIp } from "./text.ts";
import { HttpError } from "./twin.ts";

export const SPEAK_LIMITS = { chars: 600 } as const;

export function parseSpeakRequest(body: unknown): string {
  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== "string") throw new HttpError(400, "text must be a string.");
  const s = clean(text);
  if (!s) throw new HttpError(400, "Nothing to say.");
  if (s.length > SPEAK_LIMITS.chars) throw new HttpError(413, `Speech is limited to ${SPEAK_LIMITS.chars} characters at a time.`);
  return s;
}

export async function handleSpeak(request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY || !env.TTS_MODEL) throw new HttpError(503, "The twin's voice is off right now.");

  const { success } = await env.SPEAK_LIMITER.limit({ key: clientIp(request) });
  if (!success) throw new HttpError(429, "I need to rest my voice for a minute.");

  const input = parseSpeakRequest(await request.json().catch(() => null));
  const upstream = await openrouter(
    env,
    "/audio/speech",
    { model: env.TTS_MODEL, voice: env.TTS_VOICE || "am_michael", input, response_format: "mp3" },
    { timeoutMs: 20_000 },
  );
  if (!upstream.ok || !upstream.body) {
    console.error("[speak] upstream error", upstream.status, await upstream.text().catch(() => ""));
    throw new HttpError(502, "My voice cut out. Try again in a moment.");
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
