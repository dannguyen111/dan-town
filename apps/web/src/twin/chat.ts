/**
 * The Digital Twin chat: sends the conversation to /api/twin, reads the NDJSON event stream,
 * renders text as it arrives, shows offered meeting times as buttons, and (when the voice is on)
 * speaks each sentence as soon as it's complete.
 */
import type { ChatMessage } from "@dan-town/api/types";
import { renderSlots } from "./booking.ts";
import { NdjsonParser, renderMarkdown } from "./events.ts";
import { rememberRun } from "./traces.ts";
import { browserSpeechQueue, readVoicePref, SentenceChunker, unlockAudio, writeVoicePref } from "./speech.ts";
import { resetTurnstile, turnstileToken } from "./turnstile.ts";

const visitorTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
};

export function setupChat(root: HTMLElement) {
  if (root.dataset.ready) return;
  root.dataset.ready = "1";

  const first = root.dataset.first ?? "me";
  /** Who answers: the twin by default, or LeBronette at the Dev Center front desk. */
  const persona = root.dataset.persona ?? "twin";
  const speaker = root.dataset.speaker ?? "The twin";
  const log = root.querySelector<HTMLOListElement>("[data-log]")!;
  const form = root.querySelector<HTMLFormElement>("[data-form]")!;
  const input = form.querySelector<HTMLTextAreaElement>("textarea")!;
  const send = form.querySelector<HTMLButtonElement>("[data-send]")!;
  const suggest = root.querySelector<HTMLElement>("[data-suggest]")!;
  const voiceBtn = root.querySelector<HTMLButtonElement>("[data-voice]")!;
  const turnstile = form.querySelector<HTMLElement>("[data-turnstile]")!;
  const tz = visitorTz();
  const history: ChatMessage[] = [];
  let busy = false;

  // ───── voice ─────
  let voice = readVoicePref();
  const speech = browserSpeechQueue((err) => console.warn(`[${persona}] voice:`, err instanceof Error ? err.message : err), persona);
  const showVoice = () => {
    voiceBtn.setAttribute("aria-pressed", String(voice));
    voiceBtn.textContent = voice ? "🔊 Voice on" : "🔇 Voice off";
  };
  showVoice();
  // A still "speaking" light for visitors who turned animation off (the face doesn't move then).
  const onSpeaking = (e: Event) => root.toggleAttribute("data-speaking", !!(e as CustomEvent<{ on: boolean }>).detail?.on);
  document.addEventListener("twin:speaking", onSpeaking);
  voiceBtn.addEventListener("click", () => {
    voice = !voice;
    writeVoicePref(voice);
    showVoice();
    if (voice) unlockAudio(); // a user gesture, so later clips may autoplay
    else speech.stop();
  });
  document.addEventListener("astro:before-swap", () => {
    speech.stop();
    resetTurnstile();
    document.removeEventListener("twin:speaking", onSpeaking);
  }, { once: true });

  const add = (role: "user" | "twin", text = "") => {
    const li = document.createElement("li");
    li.className = `msg msg--${role}`;
    li.textContent = text;
    log.append(li);
    li.scrollIntoView({ block: "nearest" });
    return li;
  };

  async function ask(question: string) {
    if (busy || !question.trim()) return;
    busy = true;
    send.disabled = true;
    suggest.hidden = true;
    speech.stop();
    // Sending is a user gesture: re-unlock audio, since a remembered "voice on" never got one.
    if (voice) unlockAudio();
    add("user", question);
    history.push({ role: "user", content: question });
    const item = add("twin");
    const reply = document.createElement("div");
    item.append(reply);
    item.classList.add("msg--typing");
    item.setAttribute("aria-busy", "true");
    const chunker = new SentenceChunker();
    let text = "";
    try {
      const res = await fetch("/api/twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          persona,
          tz,
          turnstileToken: await turnstileToken(turnstile),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `${speaker} couldn't answer right now.` }));
        throw new Error(err.error ?? `${speaker} couldn't answer right now.`);
      }
      const parser = new NdjsonParser();
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let failure: string | null = null;
      const handle = (events: ReturnType<NdjsonParser["push"]>) => {
        for (const e of events) {
          if (e.t === "run") rememberRun(e.v);
          else if (e.t === "text") {
            text += e.v;
            // Moves the twin's mouth (twin/face.ts) while the words come in.
            document.dispatchEvent(new CustomEvent("twin:talk"));
            reply.innerHTML = renderMarkdown(text);
            if (voice) chunker.push(e.v).forEach((s) => speech.add(s));
          } else if (e.t === "slots" && e.v.length) {
            item.querySelector(".slots")?.remove(); // keep only the latest offer
            item.append(renderSlots(e.v, { first, tz, turnstile }));
          } else if (e.t === "error") failure = e.v;
        }
        item.scrollIntoView({ block: "nearest" });
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        handle(parser.push(value));
      }
      handle(parser.flush());
      if (voice) chunker.flush().forEach((s) => speech.add(s));
      if (failure && !text.trim()) throw new Error(failure);
      if (!text.trim()) throw new Error("I blanked for a second. Mind asking again?");
      history.push({ role: "assistant", content: text });
    } catch (err) {
      history.pop();
      item.classList.add("msg--error");
      item.textContent = err instanceof Error ? err.message : String(err);
    } finally {
      item.classList.remove("msg--typing");
      item.removeAttribute("aria-busy");
      busy = false;
      send.disabled = false;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    input.value = "";
    void ask(q);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  root.querySelectorAll<HTMLButtonElement>("[data-prompt]").forEach((b) => b.addEventListener("click", () => void ask(b.dataset.prompt!)));
}
