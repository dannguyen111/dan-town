import { describe, expect, it } from "vitest";
import type { FontData } from "../../../packages/readme/src/svg.ts";
import { renderOnRepeat } from "./readme-card.ts";
import type { SpotifyStats } from "./types.ts";

const face = { weight: 400, base64: "AAAA" };
const fonts: FontData = {
  retro: { family: "Press Start 2P", faces: [face] },
  term: { family: "VT323", faces: [face] },
  pixel: { family: "Pixelify Sans", faces: [face] },
};

const track = (name: string, image: string | null = null) => ({ name, artists: "Artist & Co", album: "A", image, url: "https://open.spotify.com/x" });

describe("On repeat README card", () => {
  it("lists the top five tracks, escaped", () => {
    const spotify: SpotifyStats = {
      topTracks: ["<One>", "Two", "Three", "Four", "Five", "Six"].map((n) => track(n)),
      topArtists: [],
      topGenres: ["house", "r&b"],
    };
    const svg = renderOnRepeat(spotify, "dark", fonts);
    expect(svg).toContain("&lt;One&gt;");
    expect(svg).toContain("Artist &amp; Co");
    expect(svg).toContain("Five");
    expect(svg).not.toContain("Six");
    expect(svg).toContain("r&amp;b");
    expect(svg).toContain("// ON REPEAT");
  });

  it("inlines album art it was given and leaves a placeholder otherwise", () => {
    const spotify: SpotifyStats = { topTracks: [track("A", "https://i.scdn.co/a"), track("B", "https://i.scdn.co/b")], topArtists: [], topGenres: [] };
    const svg = renderOnRepeat(spotify, "light", fonts, { "https://i.scdn.co/a": "data:image/jpeg;base64,QUJD" });
    expect(svg).toContain('href="data:image/jpeg;base64,QUJD"');
    expect(svg).not.toContain("https://i.scdn.co/b");
    expect(svg).toContain("♪");
  });

  it("says so when Spotify has nothing", () => {
    expect(renderOnRepeat(null, "light", fonts)).toContain("quiet right now");
  });
});
