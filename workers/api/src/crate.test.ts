import { describe, expect, it, vi } from "vitest";

vi.mock("./generated/twin-context.ts", () => ({
  TWIN_NAME: "Test Person",
  TWIN_VOICE: "Friendly.",
  TWIN_CONTEXT: "# Test Person",
  INTEGRATIONS: { github: { username: null }, leetcode: { username: null }, spotify: { enabled: false } },
}));

const { cosine, parseMatch, pickRecord, rankWeight, scoreMatch, soundOf, verdictFor } = await import("./crate.ts");
const { artistKey, parseSimilar, parseTags } = await import("./lastfm.ts");
const { HttpError } = await import("./twin.ts");
type Crate = import("./crate.ts").Crate;
type VisitorArtist = import("./crate.ts").VisitorArtist;

const track = (id: string, name: string, artist: string) => ({
  id,
  name,
  artists: artist,
  image: null,
  url: `https://open.spotify.com/track/${id}`,
  artistKeys: [artistKey(artist)],
});

const CRATE: Crate = {
  updatedAt: "2026-10-08T06:47:00.000Z",
  artists: [
    { key: "sza", name: "SZA", weight: rankWeight(0), tags: { rnb: 100, "neo-soul": 60 }, similar: { "frank ocean": 0.8, "h e r": 0.6 } },
    { key: "fred again", name: "Fred again..", weight: rankWeight(1), tags: { house: 100, electronic: 80 }, similar: { "four tet": 0.9 } },
    { key: "daniel caesar", name: "Daniel Caesar", weight: rankWeight(2), tags: { rnb: 100, soul: 70 }, similar: { "giveon": 0.7 } },
  ],
  tracks: [track("t1", "Snooze", "SZA"), track("t2", "Delilah", "Fred again.."), track("t3", "Get You", "Daniel Caesar")],
};

const artist = (name: string, tags: Record<string, number> = {}, similar: Record<string, number> = {}, weight = 1): VisitorArtist => ({ name, weight, tags, similar });

describe("artist names", () => {
  it("matches the same artist however it's written", () => {
    expect(artistKey("The Weeknd")).toBe(artistKey("the weeknd"));
    expect(artistKey("Beyoncé")).toBe("beyonce");
    expect(artistKey("Simon & Garfunkel")).toBe("simon and garfunkel");
    expect(artistKey("Fred again..")).toBe("fred again");
  });
});

describe("Last.fm parsing", () => {
  it("keeps real tags and drops the ones that say nothing about the sound", () => {
    const tags = parseTags({ toptags: { tag: [{ name: "Neo-Soul", count: 100 }, { name: "seen live", count: 90 }, { name: "rnb", count: "40" }, { name: "x", count: 0 }] } });
    expect(tags).toEqual({ "neo-soul": 100, rnb: 40 });
  });

  it("reads neighbours by artist key, capped at 1", () => {
    expect(parseSimilar({ similarartists: { artist: [{ name: "Frank Ocean", match: "0.81" }, { name: "Nobody", match: 0 }, { match: 1 }] } })).toEqual({ "frank ocean": 0.81 });
  });
});

describe("crate match", () => {
  it("is close to 100 for someone with the same crate", () => {
    const r = scoreMatch(CRATE, [artist("SZA", { rnb: 100, "neo-soul": 60 }), artist("Fred again..", { house: 100, electronic: 80 }), artist("Daniel Caesar", { rnb: 100, soul: 70 })]);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.verdict).toBe("Same crate");
    expect(r.shared).toEqual(["SZA", "Fred again..", "Daniel Caesar"]);
  });

  it("counts neighbours (either way round) for less than a shared artist", () => {
    const neighbour = scoreMatch(CRATE, [artist("Frank Ocean", { rnb: 100 })]);
    const reverse = scoreMatch(CRATE, [artist("Kaytranada", { house: 80 }, { "fred again": 0.5 })]);
    const shared = scoreMatch(CRATE, [artist("SZA", { rnb: 100 })]);
    expect(neighbour.neighbours[0]).toMatchObject({ yours: "Frank Ocean", mine: "SZA", similarity: 0.8 });
    expect(reverse.neighbours[0]).toMatchObject({ yours: "Kaytranada", mine: "Fred again.." });
    expect(neighbour.score).toBeLessThan(shared.score);
    expect(neighbour.score).toBeGreaterThan(30);
  });

  it("scores far-apart tastes low", () => {
    const r = scoreMatch(CRATE, [artist("Metallica", { "thrash metal": 100, metal: 90 }), artist("Slayer", { "thrash metal": 100 })]);
    expect(r.score).toBeLessThan(25);
    expect(r.shared).toEqual([]);
    expect(r.neighbours).toEqual([]);
    expect(r.sharedTags).toEqual([]);
  });

  it("still scores on artists alone when Last.fm has no tags", () => {
    const r = scoreMatch(CRATE, [artist("SZA"), artist("Nobody Known")]);
    expect(r.score).toBeGreaterThan(50);
    expect(r.score).toBeLessThan(100);
  });

  it("names the sounds both sides lean on", () => {
    expect(scoreMatch(CRATE, [artist("Somebody", { rnb: 100, house: 20, polka: 50 })]).sharedTags).toEqual(["rnb", "house"]);
  });

  it("picks a neighbour's record over a shared one, and says why", () => {
    const pick = pickRecord(CRATE, [artist("Frank Ocean", { rnb: 100 }), artist("Fred again..", { house: 100 })], soundOf([artist("x", { rnb: 100 })]));
    expect(pick).toMatchObject({ id: "t1", why: "Because you like Frank Ocean." });
  });

  it("falls back to Dan's most-played record", () => {
    expect(pickRecord(CRATE, [artist("Metallica", { metal: 100 })], { metal: 1 })).toMatchObject({ id: "t1", why: "The record Dan can't stop playing." });
    expect(pickRecord({ ...CRATE, tracks: [] }, [], {})).toBeNull();
  });

  it("has a verdict for every score", () => {
    expect([100, 85, 70, 50, 30, 1].map(verdictFor)).toEqual(["Same crate", "Same crate", "Neighbouring bins", "Across the aisle", "Different floors", "Opposite ends of the shop"]);
  });

  it("measures sound as a cosine", () => {
    expect(cosine({ a: 1 }, { a: 2 })).toBeCloseTo(1);
    expect(cosine({ a: 1 }, { b: 1 })).toBe(0);
    expect(cosine({}, { b: 1 })).toBe(0);
  });
});

describe("parseMatch", () => {
  const status = (body: unknown) => {
    try {
      parseMatch(body);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      return (e as InstanceType<typeof HttpError>).status;
    }
    return 200;
  };

  it("takes up to five distinct artist names", () => {
    expect(parseMatch({ artists: [" SZA ", "SZA", "A", "B", "C", "D", "E", 7] })).toEqual({ artists: ["SZA", "A", "B", "C", "D"] });
  });

  it("takes a Last.fm username instead", () => {
    expect(parseMatch({ lastfm: " rj_99 ", artists: ["SZA"] })).toEqual({ lastfm: "rj_99" });
  });

  it("rejects empty or odd input", () => {
    expect(status(null)).toBe(400);
    expect(status({ artists: [] })).toBe(400);
    expect(status({ artists: ["  "] })).toBe(400);
    expect(status({ lastfm: "not a user!" })).toBe(400);
  });
});
