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

  it("can't break out of a link's href", () => {
    const html = renderMarkdown('[x](https://a.com/"onmouseover="alert(1))');
    expect(html).not.toContain('"onmouseover');
    expect(html).toContain("&quot;onmouseover");
  });

  it("renders the block Markdown chat models use", () => {
    const md = ["### Projects", "Line one", "line two", "", "1. First", "2. Second", "", "- a", "* b", "> quoted", "---", "```", "npm run <dev>", "```"].join("\n");
    expect(renderMarkdown(md)).toBe(
      "<h5>Projects</h5><p>Line one<br>line two</p><ol><li>First</li><li>Second</li></ol><ul><li>a</li><li>b</li></ul>" +
        "<blockquote>quoted</blockquote><hr><pre><code>npm run &lt;dev&gt;</code></pre>",
    );
  });

  it("keeps a numbered list's start, and maps # to h3", () => {
    expect(renderMarkdown("# Hi\n3. three\n4. four")).toBe('<h3>Hi</h3><ol start="3"><li>three</li><li>four</li></ol>');
  });

  it("renders inline styles but leaves code, URLs and snake_case alone", () => {
    expect(renderMarkdown("*it* _it_ __b__ ~~no~~ `a **b** c` snake_case_name 2 * 3 * 4")).toBe(
      "<p><em>it</em> <em>it</em> <strong>b</strong> <del>no</del> <code>a **b** c</code> snake_case_name 2 * 3 * 4</p>",
    );
    expect(renderMarkdown("[repo](https://github.com/a/_x_/b)")).toBe('<p><a href="https://github.com/a/_x_/b" target="_blank" rel="noopener noreferrer">repo</a></p>');
  });

  it("shows an unclosed code block while it streams in", () => {
    expect(renderMarkdown("Try:\n```\nnpm i")).toBe("<p>Try:</p><pre><code>npm i</code></pre>");
  });
});

describe("slotLabel", () => {
  it("shows the visitor's time first, with ET alongside only when it differs", () => {
    expect(slotLabel({ et: "Wed, Oct 7, 10:00 AM EDT", local: "Wed, Oct 7, 9:00 AM CDT" })).toEqual({ main: "Wed, Oct 7, 9:00 AM CDT", et: "10:00 AM EDT" });
    expect(slotLabel({ et: "Wed, Oct 7, 10:00 AM EDT", local: "Wed, Oct 7, 10:00 AM EDT" })).toEqual({ main: "Wed, Oct 7, 10:00 AM EDT", et: null });
  });
});
