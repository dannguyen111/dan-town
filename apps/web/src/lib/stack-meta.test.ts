import { describe, expect, it } from "vitest";
import { cellsFrom, iconFor, techsIn } from "../../../../scripts/pixel-logos.ts";
import { LOGO_GRID, STACK_ROWS, canonicalTech, initials, luminance, monogram } from "./stack-meta.ts";

describe("lettered tiles", () => {
  it("takes the initials of two words, or the first two letters of one", () => {
    expect(initials("Azure DevOps")).toBe("AD");
    expect(initials("Excel")).toBe("EX");
    expect(initials("LLM Evals (LLM-as-a-judge)")).toBe("LE");
    expect(initials("CI/CD")).toBe("CC");
  });

  it("knocks the letters out of a full rounded tile", () => {
    const rows = monogram("Research");
    expect(rows).toHaveLength(LOGO_GRID);
    for (const r of rows) expect(r).toHaveLength(LOGO_GRID);
    expect(rows[0]![0]).toBe(".");
    expect(rows.join("")).toContain("o");
  });
});

it("hand-drawn logos are full grids", () => {
  for (const [name, rows] of Object.entries(STACK_ROWS)) {
    expect(rows, name).toHaveLength(LOGO_GRID);
    for (const r of rows) expect(r, name).toHaveLength(LOGO_GRID);
  }
});

it("folds aliases of a tech into one name and measures brand colours", () => {
  expect(canonicalTech("Stripe Connect")).toBe("Stripe");
  expect(canonicalTech("Python")).toBe("Python");
  expect(luminance("#000000")).toBe(0);
  expect(luminance("#ffffff")).toBeCloseTo(1);
});

describe("pixelating logos", () => {
  const icons = [
    { slug: "python", title: "Python", hex: "3776AB", path: "" },
    { slug: "html5", title: "HTML5", hex: "E34F26", path: "" },
    { slug: "delta", title: "Delta", hex: "003366", path: "" },
  ];

  it("matches names to icons by title or alias, and never Delta Lake to the airline", () => {
    expect(iconFor("Python", icons)?.slug).toBe("python");
    expect(iconFor("HTML/CSS", icons)?.slug).toBe("html5");
    expect(iconFor("Delta Lake", icons)).toBeNull();
    expect(iconFor("RAG", icons)).toBeNull();
  });

  it("lights a cell when enough of it is covered", () => {
    // A 2×2 grid at 8 pixels per cell: the left half opaque.
    const w = 16;
    const rgba = new Uint8Array(w * w * 4);
    for (let y = 0; y < w; y++) for (let x = 0; x < 8; x++) rgba[(y * w + x) * 4 + 3] = 255;
    expect(cellsFrom(rgba, 2)).toEqual(["#.", "#."]);
  });

  it("collects software techs from the profile, but not the math", () => {
    const techs = techsIn({
      skills: [
        { group: "Data", items: ["SQL"] },
        { group: "Mathematics", items: ["Real Analysis"] },
      ],
      projects: [{ tags: ["Rust", "SQL"] }],
      experience: [{ skills: ["Go"] }, {}],
    });
    expect(techs).toEqual(["Go", "Rust", "SQL"]);
  });
});
