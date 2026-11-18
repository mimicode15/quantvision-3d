import { describe, expect, it } from "vitest";
import { DOC_SECTIONS } from "./docs";

describe("docs content", () => {
  it("has unique section ids and titles", () => {
    const ids = DOC_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of DOC_SECTIONS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.blocks.length).toBeGreaterThan(0);
    }
  });

  it("has no empty text or lists", () => {
    for (const s of DOC_SECTIONS) {
      for (const b of s.blocks) {
        if (b.kind === "p") expect(b.text.trim().length).toBeGreaterThan(0);
        if (b.kind === "list") expect(b.items.length).toBeGreaterThan(0);
        if (b.kind === "math") expect(b.tex.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("covers hands, the sphere, the math and noise", () => {
    const ids = DOC_SECTIONS.map((s) => s.id);
    for (const id of ["hands", "sphere", "math", "noise"]) expect(ids).toContain(id);
  });
});
