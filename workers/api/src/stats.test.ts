import { describe, expect, it, vi } from "vitest";

vi.mock("./generated/twin-context.ts", () => ({
  INTEGRATIONS: { github: { username: null }, leetcode: { username: null }, spotify: { enabled: true } },
}));

const { summarizeSpotify } = await import("./stats.ts");

describe("summarizeSpotify", () => {
  it("tolerates artists without genres or images (current Spotify API)", () => {
    const out = summarizeSpotify(
      [{ name: "Song", artists: [{ name: "A" }, { name: "B" }], album: { name: "LP" }, external_urls: { spotify: "https://x" } }],
      [{ name: "A" }, { name: "B", genres: ["house"], images: [{ url: "big" }, { url: "small" }] }],
    );
    expect(out.topTracks[0]).toEqual({ name: "Song", artists: "A, B", album: "LP", image: null, url: "https://x" });
    expect(out.topArtists.map((a) => a.genres)).toEqual([[], ["house"]]);
    expect(out.topArtists[1]!.image).toBe("small");
    expect(out.topGenres).toEqual(["house"]);
  });

  it("handles empty responses", () => {
    expect(summarizeSpotify()).toEqual({ topTracks: [], topArtists: [], topGenres: [] });
  });
});
