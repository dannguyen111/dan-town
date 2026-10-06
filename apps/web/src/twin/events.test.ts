import { describe, expect, it } from "vitest";
import { NdjsonParser, renderMarkdown, slotLabel } from "./events.ts";

describe("NdjsonParser", () => {
  it("parses events split across chunks and skips junk", () => {
    const p = new NdjsonParser();
    expect(p.push('{"t":"text","v":"Hel')).toEqual([]);
    expect(p.push('lo"}\n{"t":"slots","v":[]}\nnot json\n{"t":"other","v":1}\n{"t":"error"')).toEqual([
      { t: "text", v: "Hello" },
      { t: "slots", v: [] },
    ]);
    expect(p.push(',"v":"oops"}')).toEqual([]);
    expect(p.flush()).toEqual([{ t: "error", v: "oops" }]);
  });
});

describe("renderMarkdown", () => {
  it("escapes HTML and allows only safe links", () => {
    expect(renderMarkdown("<b>hi</b> **bold** [x](javascript:alert(1)) [gh](https://github.com)")).toBe(
      '<p>&lt;b&gt;hi&lt;/b&gt; <strong>bold</strong> [x](javascript:alert(1)) <a href="https://github.com" target="_blank" rel="noopener noreferrer">gh</a></p>',
    );
  });
});

describe("slotLabel", () => {
  it("shows the visitor's time first, with ET alongside only when it differs", () => {
    expect(slotLabel({ et: "Wed, Oct 7, 10:00 AM EDT", local: "Wed, Oct 7, 9:00 AM CDT" })).toEqual({ main: "Wed, Oct 7, 9:00 AM CDT", et: "10:00 AM EDT" });
    expect(slotLabel({ et: "Wed, Oct 7, 10:00 AM EDT", local: "Wed, Oct 7, 10:00 AM EDT" })).toEqual({ main: "Wed, Oct 7, 10:00 AM EDT", et: null });
  });
});
