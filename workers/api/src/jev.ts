/**
 * A tiny typed client for Jev, TypeSafe's decision model, through OpenRouter's Decisions API.
 *
 * Jev doesn't generate text: it evaluates typed questions against a `state` and returns
 * calibrated probabilities. That makes it a good fit for sorting untrusted visitor text, because
 * there is no output for an injection to hijack, only a probability to move.
 * Docs: https://openrouter.ai/docs/guides/community/jev
 */

export const DECISIONS_ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
export const JEV_MODEL = "typesafe/jev-1.13";

type Instructions = string | Record<string, unknown> | unknown[];

export interface NoulQuestion {
  type: "noul";
  instructions: Instructions;
  criteria?: { true?: string; false?: string };
}

export interface ChoiceQuestion<O extends string = string> {
  type: "choice";
  instructions: Instructions;
  criteria: Record<O, string | null>;
}

export type Question = NoulQuestion | ChoiceQuestion;

export interface NoulAnswer {
  type: "noul";
  /** Probability the answer is yes, 0–1. */
  noul: number;
}

export interface ChoiceAnswer<O extends string = string> {
  type: "choice";
  choice: O;
  probabilities: Record<O, number>;
  /** How concentrated the probabilities are, 0–1. */
  confidence: number;
}

export type AnswerFor<Q> = Q extends ChoiceQuestion<infer O> ? ChoiceAnswer<O> : Q extends NoulQuestion ? NoulAnswer : never;
export type Answers<Qs extends Record<string, Question>> = { [K in keyof Qs]: AnswerFor<Qs[K]> };

export const noul = (instructions: Instructions, criteria?: NoulQuestion["criteria"]): NoulQuestion => ({ type: "noul", instructions, criteria });
export const choice = <O extends string>(instructions: Instructions, criteria: Record<O, string | null>): ChoiceQuestion<O> => ({
  type: "choice",
  instructions,
  criteria,
});

export class JevError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export interface DecisionRequest<Qs extends Record<string, Question>> {
  /** An OpenRouter API key. */
  apiKey: string;
  model?: string;
  state: unknown;
  questions: Qs;
  /** Sent as OpenRouter's HTTP-Referer / X-Title attribution headers. */
  referer?: string;
  title?: string;
  timeoutMs?: number;
}

const isProbability = (n: unknown): n is number => typeof n === "number" && n >= 0 && n <= 1;

/** Checks each answer has the type and options its question asked for, so callers can trust the types. */
export function parseAnswers<Qs extends Record<string, Question>>(questions: Qs, body: unknown): Answers<Qs> {
  const answers = (body as { answers?: Record<string, unknown> } | null)?.answers;
  if (!answers || typeof answers !== "object") throw new JevError(502, "Jev response has no answers.");
  for (const [id, q] of Object.entries(questions)) {
    const a = answers[id] as Record<string, unknown> | undefined;
    if (!a || a.type !== q.type) throw new JevError(502, `Jev answer "${id}" is missing or has the wrong type.`);
    if (q.type === "noul" && !isProbability(a.noul)) throw new JevError(502, `Jev answer "${id}" has no probability.`);
    if (q.type === "choice" && (typeof a.choice !== "string" || !(a.choice in q.criteria) || !isProbability(a.confidence))) {
      throw new JevError(502, `Jev answer "${id}" picked an unknown option.`);
    }
  }
  return answers as Answers<Qs>;
}

/** One Decisions request. Retries once when OpenRouter or the provider is busy (429/503/529). */
export async function decide<Qs extends Record<string, Question>>(req: DecisionRequest<Qs>): Promise<Answers<Qs>> {
  const call = () =>
    fetch(DECISIONS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${req.apiKey}`,
        "Content-Type": "application/json",
        ...(req.referer ? { "HTTP-Referer": req.referer } : {}),
        ...(req.title ? { "X-Title": req.title } : {}),
      },
      body: JSON.stringify({ model: req.model || JEV_MODEL, state: req.state, questions: req.questions }),
      signal: AbortSignal.timeout(req.timeoutMs ?? 10_000),
    });
  let res = await call();
  if (res.status === 429 || res.status === 503 || res.status === 529) {
    await new Promise((r) => setTimeout(r, 750));
    res = await call();
  }
  if (!res.ok) throw new JevError(res.status, `Jev returned ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return parseAnswers(req.questions, await res.json());
}
