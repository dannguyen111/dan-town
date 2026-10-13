import { describe, expect, it } from "vitest";
import { loadProfile, projectFor } from "@dan-town/profile";
import { renderReadme } from "./readme.ts";
import { textWidth, wrap, type FontData } from "./svg.ts";

const yaml = `
version: 1
identity:
  name: Test Person
  short_name: Test
  headline: AI & Software Engineer
  tagline: Builds <fun> things.
  open_to: New roles in AI.
about: { intro: Hello there. }
links:
  - { id: github, label: GitHub, url: "https://github.com/x" }
  - { id: secret, label: Secret, url: "https://secret.example", visibility: private }
experience:
  - { id: a, role: Public Role, org: Acme, start: 2024-01, end: null, highlights: [Did public things] }
  - { id: b, role: Twin Role, org: Hidden Co, start: 2023-01, end: 2023-06, visibility: twin }
  - { id: c, role: Private Role, org: Stealth, start: 2022-01, end: 2022-02, visibility: private }
education:
  - { id: uni, school: Uni, degree: B.S. in Computer Science and Mathematics, start: 2022-08, end: 2026-05, rank: 1/100 }
projects:
  - { id: vendora, title: "Vendora: A Marketplace", tagline: Sells things & more, date: 2026-07, start: 2026-07, end: null, tags: [Next.js, TypeScript] }
  - { id: appc-chatbot, title: A Very Long Project Title Indeed, tagline: Answers questions, date: 2026-05, tags: [RAG, Python] }
  - { id: hidden, title: Hidden Project, tagline: Nope, date: 2026-01, visibility: twin }
skills:
  - { group: Languages, items: [Python, TypeScript, Go] }
  - { group: Mathematics, items: [Combinatorics] }
  - { group: Secret Skills, items: [Lockpicking], visibility: private }
honors:
  - { title: Summa Cum Laude, org: Uni, date: 2026-05 }
  - { title: Secret Award, org: Stealth, date: 2025-01, visibility: private }
interests:
  - { id: dj, title: DJing, emoji: "🎧", blurb: Behind the deck. }
twin:
  notes:
    - { text: Twin-only fact, visibility: twin }
integrations:
  github: { username: tester }
  spotify: { enabled: true }
private:
  phone: 555-0100
`;

const face = { weight: 400, base64: "AAAA" };
const fonts: FontData = {
  retro: { family: "Press Start 2P", faces: [face] },
  term: { family: "VT323", faces: [face] },
  pixel: { family: "Pixelify Sans", faces: [face, { ...face, weight: 600 }] },
};

const files = renderReadme({ profile: projectFor(loadProfile(yaml), "public"), fonts, pixelated: {} });
const readme = files.get("README.md")!;
const svgs = [...files].filter(([name]) => name.endsWith(".svg"));

/** Every opened tag is closed, in order. */
function balanced(xml: string): boolean {
  const stack: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    const [, close, name, self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
}

describe("README generator", () => {
  it("never shows twin-only or private entries", () => {
    for (const [name, content] of files) {
      for (const secret of ["Twin Role", "Hidden Co", "Stealth", "Private Role", "Twin-only fact", "555-0100", "secret.example", "Hidden Project", "Lockpicking", "Secret Award"]) {
        expect(content, `${name} leaks "${secret}"`).not.toContain(secret);
      }
    }
  });

  it("renders every card in both themes, as well-formed SVG", () => {
    expect(svgs.length).toBeGreaterThan(10);
    for (const [name, content] of svgs) {
      expect(content.startsWith("<svg "), name).toBe(true);
      expect(content.endsWith("</svg>"), name).toBe(true);
      expect(balanced(content), `${name} is not well-formed`).toBe(true);
      const twin = name.endsWith("-light.svg") ? name.replace("-light.svg", "-dark.svg") : name.replace("-dark.svg", "-light.svg");
      expect(files.has(twin), `${name} has no ${twin}`).toBe(true);
    }
  });

  it("escapes profile text", () => {
    const typing = files.get("readme/typing-light.svg")!;
    expect(typing).toContain("Builds &lt;fun&gt; things.");
    expect(files.get("readme/build-vendora-dark.svg")).toContain("Sells things &amp; more");
    expect(readme).toContain("Builds &lt;fun&gt; things.");
  });

  it("links only to files it wrote", () => {
    const refs = [...readme.matchAll(/(?:src|srcset)="(readme\/[^"]+)"/g)].map((m) => m[1]!);
    expect(refs.length).toBeGreaterThan(10);
    for (const ref of refs) expect(files.has(ref), ref).toBe(true);
  });

  it("pins the board's builds, with their site links", () => {
    expect(readme).toContain("https://si-dan.com/projects/vendora");
    expect(readme).toContain("https://si-dan.com/projects/appc-chatbot");
    expect(files.get("readme/build-vendora-light.svg")).toContain("ACTIVE");
    expect(files.get("readme/build-appc-chatbot-light.svg")).toContain("APPC CHATBOT");
  });

  it("points the live and activity widgets at the right places", () => {
    expect(readme).toContain("https://si-dan.com/api/readme/on-repeat.svg?theme=dark");
    expect(readme).toContain("https://raw.githubusercontent.com/tester/tester/output/snake-dark.svg");
    expect(readme).toContain("https://raw.githubusercontent.com/tester/tester/output/profile-3d-light.svg");
  });
});

describe("wrap", () => {
  it("keeps every line within the width", () => {
    const text = "I build intelligent, AI-driven applications that solve complex, real-world problems with supercalifragilisticexpialidocious care.";
    for (const width of [80, 150, 300]) {
      const lines = wrap(text, "term", 20, width);
      for (const line of lines) expect(textWidth(line, "term", 20)).toBeLessThanOrEqual(width);
    }
  });
});
