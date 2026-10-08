import { describe, expect, it } from "vitest";
import { loadProfile, ProfileError, projectFor, renderFullMarkdown, renderTwinContext } from "./compile.ts";

const yaml = `
version: 1
identity: { name: Test Person, short_name: Test, headline: Engineer, tagline: Builds things. }
about: { intro: Hello. }
links:
  - { id: gh, label: GitHub, url: "https://github.com/x" }
  - { id: secret, label: Secret, url: "https://secret.example", visibility: private }
experience:
  - { id: a, role: Public Role, org: Acme, start: 2024-01, end: null, highlights: [Did public things] }
  - { id: b, role: Twin Role, org: Hidden Co, start: 2023-01, end: 2023-06, visibility: twin }
  - { id: c, role: Private Role, org: Stealth, start: 2022-01, end: 2022-02, visibility: private }
  - { id: d, role: Lab Assistant, org: Uni, start: 2021-01, end: 2021-06, research: true }
research:
  statement: I want to study things.
  interests:
    - { text: Public interest }
    - { text: Secret interest, visibility: private }
twin:
  notes:
    - { text: Twin-only fact, visibility: twin }
private:
  salary_expectation: 999
`;

describe("profile compiler", () => {
  const profile = loadProfile(yaml);

  it("public view drops twin, private and the private block", () => {
    const pub = projectFor(profile, "public");
    const json = JSON.stringify(pub);
    expect(pub.experience.map((e) => e.id)).toEqual(["a", "d"]);
    expect(json).not.toContain("Hidden Co");
    expect(json).not.toContain("Stealth");
    expect(json).not.toContain("secret.example");
    expect(json).not.toContain("salary");
    expect(json).not.toContain("Twin-only fact");
    expect(json).not.toContain('"visibility"');
  });

  it("twin context includes twin entries but never private ones", () => {
    const ctx = renderTwinContext(profile);
    expect(ctx).toContain("Hidden Co");
    expect(ctx).toContain("Twin-only fact");
    expect(ctx).not.toContain("Stealth");
    expect(ctx).not.toContain("secret.example");
    expect(ctx).not.toContain("999");
  });

  it("keeps research flags and public research interests", () => {
    const pub = projectFor(profile, "public");
    expect(pub.experience.find((e) => e.id === "d")?.research).toBe(true);
    expect(pub.experience.find((e) => e.id === "a")?.research).toBe(false);
    expect(pub.research.interests.map((i) => i.text)).toEqual(["Public interest"]);
    const ctx = renderTwinContext(profile);
    expect(ctx).toContain("Lab Assistant, Uni (2021-01 – 2021-06) [research]");
    expect(ctx).toContain("I want to study things.");
    expect(ctx).not.toContain("Secret interest");
  });

  it("full export includes everything (for private resume workflows)", () => {
    const md = renderFullMarkdown(profile);
    expect(md).toContain("Stealth");
    expect(md).toContain("salary_expectation");
  });

  it("reports every validation problem with its path", () => {
    expect(() => loadProfile("version: 1\nidentity: { name: X }\nabout: { intro: hi }\nexperience: [{ id: a, role: r, org: o, start: 2024-13, end: null }]"))
      .toThrowError(ProfileError);
    try {
      loadProfile("version: 1\nidentity: { name: X }\nabout: { intro: hi }");
    } catch (e) {
      expect((e as Error).message).toContain("identity.headline");
    }
  });
});

describe("research framing", () => {
  const framed = loadProfile(`
version: 1
identity: { name: T, short_name: T, headline: H, tagline: t }
about: { intro: Hi. }
experience:
  - id: r
    role: Analyst
    org: Acme
    start: 2024-01
    end: 2024-06
    research: true
    highlights: [Professional bullet]
    research_framing:
      question: Which clustering fits best?
      methods: [Clustering]
      findings: [Validated with auditors]
      implications: Next, test on new data.
  - { id: s, role: Plain, org: Acme, start: 2023-01, end: 2023-06, research: true, highlights: [Only professional] }
`);

  it("twin context labels the research framing next to the professional text", () => {
    const md = renderTwinContext(framed);
    expect(md).toContain("- Professional bullet");
    expect(md).toContain("Research framing:");
    expect(md).toContain("- Question: Which clustering fits best?");
    expect(md).toContain("- Finding: Validated with auditors");
    expect(md).toContain("- Implications: Next, test on new data.");
  });

  it("a framing's pipeline is optional and reaches the twin in order", () => {
    expect(framed.experience[0]!.research_framing!.pipeline).toEqual([]);
    const piped = loadProfile(`
version: 1
identity: { name: T, short_name: T, headline: H, tagline: t }
about: { intro: Hi. }
projects:
  - id: p
    title: P
    tagline: t
    date: 2026-10
    research: true
    research_framing:
      question: Q?
      pipeline:
        - { label: Solver, detail: computes }
        - { label: Referee, detail: checks, loop: reject → back }
`);
    expect(piped.projects[0]!.research_framing!.pipeline).toHaveLength(2);
    expect(renderTwinContext(piped)).toContain("- Pipeline: Solver (computes) → Referee (checks; reject → back)");
  });

  it("flagged entries without a framing add no framing block", () => {
    const md = renderTwinContext(framed);
    expect(md.match(/Research framing:/g)).toHaveLength(1);
    expect(md).toContain("### Plain, Acme (2023-01 – 2023-06) [research]");
  });
});
