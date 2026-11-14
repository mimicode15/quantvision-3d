import { describe, expect, it } from "vitest";
import cases from "../../../shared/fixtures/noise_cases.json";
import {
  clampT2,
  densityFromBloch,
  describePurity,
  evolveBloch,
  survival,
  t2WithinLimit,
} from "./decoherence";
import { blochFromDensity, purity } from "./hud";
import {
  blochLengthFromPurity,
  blochVectorFromAngles,
  purityFromBloch,
  type Vec3,
} from "./quantum";

const length = (v: Vec3): number => Math.hypot(...v);

describe("evolveBloch against the Python (Kraus operator) results", () => {
  for (const c of cases) {
    it(`theta ${c.theta.toFixed(2)}, t=${c.t}, T1=${c.t1}, T2=${c.t2}`, () => {
      const start = blochVectorFromAngles(c.theta, c.phi);
      const out = evolveBloch(start, { t: c.t, t1: c.t1, t2: c.t2 });
      c.bloch.forEach((value, i) => expect(Math.abs(out[i] - value)).toBeLessThan(1e-9));
      expect(Math.abs(purityFromBloch(out) - c.purity)).toBeLessThan(1e-9);
      const { population, coherence } = survival({ t: c.t, t1: c.t1, t2: c.t2 });
      expect(Math.abs(population - c.population)).toBeLessThan(1e-12);
      expect(Math.abs(coherence - c.coherence)).toBeLessThan(1e-12);
    });
  }
});

describe("limits", () => {
  it("does nothing at t = 0", () => {
    const r: Vec3 = [0.3, -0.4, 0.5];
    const out = evolveBloch(r, { t: 0, t1: 50, t2: 40 });
    expect(out).toEqual(r);
  });

  it("ends up at |0>, the north pole, after a long time", () => {
    const out = evolveBloch([0.6, 0.2, -0.77], { t: 1e5, t1: 50, t2: 40 });
    expect(Math.abs(out[0])).toBeLessThan(1e-9);
    expect(Math.abs(out[1])).toBeLessThan(1e-9);
    expect(Math.abs(out[2] - 1)).toBeLessThan(1e-9);
  });

  it("leaves |0> alone, since it is already the ground state", () => {
    const out = evolveBloch([0, 0, 1], { t: 80, t1: 50, t2: 40 });
    expect(out).toEqual([0, 0, 1]);
  });

  it("T2 = 2*T1 means only relaxation: x shrinks by exp(-t/(2 T1))", () => {
    const out = evolveBloch([1, 0, 0], { t: 100, t1: 100, t2: 200 });
    expect(Math.abs(out[0] - Math.exp(-0.5))).toBeLessThan(1e-12);
  });

  it("rejects T2 above 2*T1 and bad numbers", () => {
    expect(() => evolveBloch([1, 0, 0], { t: 1, t1: 10, t2: 21 })).toThrow(RangeError);
    expect(() => evolveBloch([1, 0, 0], { t: -1, t1: 10, t2: 10 })).toThrow(RangeError);
    expect(() => evolveBloch([1, 0, 0], { t: 1, t1: 0, t2: 10 })).toThrow(RangeError);
    expect(() => evolveBloch([1, 0, 0], { t: Infinity, t1: 10, t2: 10 })).toThrow(RangeError);
  });

  it("knows the T2 limit", () => {
    expect(t2WithinLimit(100, 200)).toBe(true);
    expect(t2WithinLimit(100, 200.5)).toBe(false);
    expect(clampT2(100, 350)).toBe(200);
    expect(clampT2(100, 60)).toBe(60);
  });
});

describe("purity as the state decoheres", () => {
  it("only dephasing (T1 huge): purity never goes up", () => {
    const start = blochVectorFromAngles(Math.PI / 2, 0.7);
    let last = 1;
    for (let t = 0; t <= 400; t += 5) {
      const p = purityFromBloch(evolveBloch(start, { t, t1: 1e12, t2: 60 }));
      expect(p).toBeLessThanOrEqual(last + 1e-12);
      last = p;
    }
  });

  it("T1 can lower purity and then raise it again as the state falls into |0>", () => {
    // Start in |1>: the needle shrinks through the centre, then grows back up toward +z.
    const start: Vec3 = [0, 0, -1];
    const t1 = 100;
    const mid = purityFromBloch(evolveBloch(start, { t: t1 * Math.LN2, t1, t2: 2 * t1 }));
    const late = purityFromBloch(evolveBloch(start, { t: 20 * t1, t1, t2: 2 * t1 }));
    expect(Math.abs(mid - 0.5)).toBeLessThan(1e-9);
    expect(late).toBeGreaterThan(0.99);
  });

  it("the needle length is sqrt(2*purity - 1) and never leaves the sphere", () => {
    const start = blochVectorFromAngles(1.1, 2.3);
    for (const t of [0, 10, 50, 200, 1000]) {
      const out = evolveBloch(start, { t, t1: 80, t2: 60 });
      expect(length(out)).toBeLessThanOrEqual(1 + 1e-12);
      expect(Math.abs(blochLengthFromPurity(purityFromBloch(out)) - length(out))).toBeLessThan(
        1e-9,
      );
    }
  });
});

describe("densityFromBloch", () => {
  it("round-trips through blochFromDensity", () => {
    const r: Vec3 = [0.2, -0.3, 0.4];
    const back = blochFromDensity(densityFromBloch(r));
    r.forEach((v, i) => expect(Math.abs(back[i] - v)).toBeLessThan(1e-12));
  });

  it("has trace 1, is Hermitian, and has the right purity", () => {
    const r: Vec3 = [0.2, -0.3, 0.4];
    const rho = densityFromBloch(r);
    expect(Math.abs(rho[0][0].re + rho[1][1].re - 1)).toBeLessThan(1e-12);
    expect(rho[0][1].re).toBe(rho[1][0].re);
    expect(rho[0][1].im).toBe(-rho[1][0].im);
    expect(Math.abs(purity(rho) - purityFromBloch(r))).toBeLessThan(1e-12);
  });

  it("the maximally mixed state is I/2 with purity 1/2", () => {
    const rho = densityFromBloch([0, 0, 0]);
    expect(rho[0][0].re).toBe(0.5);
    expect(rho[1][1].re).toBe(0.5);
    expect(purity(rho)).toBe(0.5);
  });
});

describe("describePurity", () => {
  it("says something sensible at each level", () => {
    expect(describePurity(1)).toContain("pure");
    expect(describePurity(0.95)).toContain("slightly");
    expect(describePurity(0.82)).toBe("Purity 0.82: partly mixed.");
    expect(describePurity(0.5)).toContain("completely mixed");
  });
});
