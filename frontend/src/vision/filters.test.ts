import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "./filters";

const FRAME = 1000 / 30;

/** Deterministic pseudo-noise in [-1, 1]. */
const noise = (i: number): number => Math.sin(i * 12.9898) * 0.5 + Math.sin(i * 78.233) * 0.5;

describe("OneEuroFilter", () => {
  it("returns the first sample unchanged", () => {
    expect(new OneEuroFilter(1, 0).filter(0.7, 0)).toBe(0.7);
  });

  it("settles on a constant input", () => {
    const filter = new OneEuroFilter(1, 0);
    let out = 0;
    for (let i = 0; i < 120; i++) out = filter.filter(0.4, i * FRAME);
    expect(out).toBeCloseTo(0.4, 6);
  });

  it("calms jitter around a still value", () => {
    const filter = new OneEuroFilter(1, 0);
    let rawSpread = 0;
    let outSpread = 0;
    for (let i = 0; i < 300; i++) {
      const raw = 0.5 + 0.01 * noise(i);
      const out = filter.filter(raw, i * FRAME);
      if (i > 60) {
        rawSpread += Math.abs(raw - 0.5);
        outSpread += Math.abs(out - 0.5);
      }
    }
    expect(outSpread).toBeLessThan(rawSpread * 0.5);
  });

  it("lags less on fast motion when beta is raised", () => {
    const lagAfterStep = (beta: number): number => {
      const filter = new OneEuroFilter(1, beta);
      for (let i = 0; i < 30; i++) filter.filter(0, i * FRAME);
      let out = 0;
      for (let i = 30; i < 36; i++) out = filter.filter(1, i * FRAME); // sudden jump
      return 1 - out;
    };
    expect(lagAfterStep(20)).toBeLessThan(lagAfterStep(0));
  });

  it("starts fresh after reset()", () => {
    const filter = new OneEuroFilter(1, 0);
    for (let i = 0; i < 30; i++) filter.filter(0, i * FRAME);
    filter.reset();
    expect(filter.filter(0.9, 2000)).toBe(0.9);
  });

  it("survives repeated timestamps without dividing by zero", () => {
    const filter = new OneEuroFilter(1, 1);
    filter.filter(0, 100);
    const out = filter.filter(1, 100);
    expect(Number.isFinite(out)).toBe(true);
  });
});
