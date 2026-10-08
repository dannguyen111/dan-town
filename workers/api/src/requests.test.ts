import { describe, expect, it, vi } from "vitest";
import type { StoredRequest } from "./request-store.ts";

vi.mock("./generated/twin-context.ts", () => ({
  TWIN_NAME: "Test Person",
  TWIN_VOICE: "Friendly.",
  TWIN_CONTEXT: "# Test Person",
  INTEGRATIONS: { github: { username: null }, leetcode: { username: null }, spotify: { enabled: false } },
}));

const { REQUEST_LIMITS, parseSongRequest, renderRequestEmail } = await import("./requests.ts");
const { HttpError } = await import("./twin.ts");

const status = (body: unknown) => {
  try {
    parseSongRequest(body);
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    return (e as InstanceType<typeof HttpError>).status;
  }
  return 200;
};

const REQ: StoredRequest = {
  id: "r1",
  at: "2026-10-08T20:00:00.000Z",
  name: "Alex <script>",
  note: "You'd love the bridge & the <b>outro</b>",
  track: { id: "abc123DEF456", name: "Nights", artists: "Frank Ocean", image: null, url: "https://open.spotify.com/track/abc123DEF456" },
  injection: 0.01,
  junk: 0.02,
  status: "pending",
};

describe("parseSongRequest", () => {
  it("needs a song, and keeps the note and name tidy", () => {
    expect(parseSongRequest({ trackId: "abc", note: "  hi\u0007 ", name: " Sam " })).toEqual({ trackId: "abc", note: "hi", name: "Sam", website: "", turnstileToken: undefined });
  });

  it("rejects requests without a song, or with oversized fields", () => {
    expect(status(null)).toBe(400);
    expect(status({ note: "hi" })).toBe(400);
    expect(status({ trackId: "abc", note: "x".repeat(REQUEST_LIMITS.note + 1) })).toBe(413);
    expect(status({ trackId: "abc", name: 5 })).toBe(400);
  });
});

describe("renderRequestEmail", () => {
  const links = { approve: "https://si-dan.com/api/requests/moderate?id=r1&action=approve&sig=a", reject: "https://si-dan.com/api/requests/moderate?id=r1&action=reject&sig=b" };

  it("names the song in the subject and escapes everything the visitor wrote", () => {
    const mail = renderRequestEmail(REQ, { injection: 0.01, junk: 0.02 }, links);
    expect(mail.subject).toBe('🎧 Alex <script> requested "Nights by Frank Ocean"');
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("Alex &lt;script&gt;");
    expect(mail.html).toContain("&lt;b&gt;outro&lt;/b&gt;");
    expect(mail.html).toContain("id=r1&amp;action=approve");
    expect(mail.text).toContain("Listen: https://open.spotify.com/track/abc123DEF456");
  });

  it("flags a suspicious note and still works without links", () => {
    const mail = renderRequestEmail(REQ, { injection: 0.9, junk: 0 }, null);
    expect(mail.subject.startsWith("⚠️ Flagged · ")).toBe(true);
    expect(mail.text).toContain("Set the FRIDGE_SECRET secret");
  });
});
