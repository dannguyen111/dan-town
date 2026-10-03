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
    expect(pub.experience.map((e) => e.id)).toEqual(["a"]);
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
