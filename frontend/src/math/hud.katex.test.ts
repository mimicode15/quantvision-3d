import { renderToString } from "katex";
import { describe, expect, it } from "vitest";
import { GENERAL_STATE_TEX, densityMatrix, densityTex, diracTex } from "./hud";
import { stateFromAngles } from "./quantum";

const strict = { throwOnError: true, strict: "error" as const };

describe("HUD LaTeX is valid KaTeX", () => {
  it("renders the general formula", () => {
    expect(renderToString(GENERAL_STATE_TEX, strict)).toContain("katex");
  });

  it("renders every state on a dense angle sweep without errors", () => {
    let count = 0;
    for (let t = 0; t <= 36; t++) {
      for (let p = 0; p < 72; p += 1) {
        const state = stateFromAngles((t * Math.PI) / 36, (p * 2 * Math.PI) / 72);
        renderToString(diracTex(state), strict);
        renderToString(densityTex(densityMatrix(state)), strict);
        count++;
      }
    }
    expect(count).toBeGreaterThan(2000);
  });

  it("uses a monospace font class for the numbers (so the HUD can set them in Syne Mono)", () => {
    expect(renderToString(diracTex(stateFromAngles(1, 1)), strict)).toContain("mathtt");
  });
});
