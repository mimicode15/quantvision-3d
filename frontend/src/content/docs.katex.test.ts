import { renderToString } from "katex";
import { describe, expect, it } from "vitest";
import { DOC_SECTIONS } from "./docs";

describe("docs formulas are valid KaTeX", () => {
  it("renders every formula in strict mode", () => {
    let count = 0;
    for (const s of DOC_SECTIONS) {
      for (const b of s.blocks) {
        if (b.kind !== "math") continue;
        const html = renderToString(b.tex, {
          throwOnError: true,
          strict: "error",
          displayMode: true,
        });
        expect(html).toContain("katex");
        count++;
      }
    }
    expect(count).toBeGreaterThan(5);
  });
});
