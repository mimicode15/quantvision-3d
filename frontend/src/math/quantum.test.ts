import { describe, expect, it } from "vitest";
import cases from "../../../shared/fixtures/gate_cases.json";
import {
  GATES,
  H,
  IDENTITY,
  S,
  T,
  X,
  Y,
  Z,
  anglesFromState,
  applyGate,
  blochLengthFromPurity,
  blochVector,
  blochVectorFromAngles,
  fidelity,
  isUnitary,
  matMul,
  measure,
  measurementProbabilities,
  oneState,
  purityFromBloch,
  rx,
  ry,
  rz,
  stateFromAngles,
  zeroState,
  type Mat2,
  type Vec2,
  type Vec3,
} from "./quantum";

const close = (a: readonly number[], b: readonly number[], digits = 10) => {
  expect(a).toHaveLength(b.length);
  a.forEach((value, i) => expect(value).toBeCloseTo(b[i] as number, digits));
};

const matClose = (a: Mat2, b: Mat2) => {
  for (const r of [0, 1] as const) {
    for (const k of [0, 1] as const) {
      expect(a[r][k].re).toBeCloseTo(b[r][k].re, 10);
      expect(a[r][k].im).toBeCloseTo(b[r][k].im, 10);
    }
  }
};

// small deterministic PRNG so the statistics test never flakes
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("gates", () => {
  it("are unitary", () => {
    for (const gate of Object.values(GATES)) expect(isUnitary(gate)).toBe(true);
    for (const angle of [-3, -0.5, 0, 0.7, Math.PI, 5.1]) {
      for (const build of [rx, ry, rz]) expect(isUnitary(build(angle))).toBe(true);
    }
  });

  it("satisfy the standard identities", () => {
    matClose(matMul(H, matMul(Z, H)), X);
    matClose(matMul(H, matMul(X, H)), Z);
    matClose(matMul(H, H), IDENTITY);
    matClose(matMul(S, S), Z);
    matClose(matMul(T, T), S);
    matClose(matMul(X, X), IDENTITY);
  });

  it("move basis states correctly", () => {
    close(blochVector(applyGate(X, zeroState())), [0, 0, -1]);
    close(blochVector(applyGate(Y, zeroState())), [0, 0, -1]);
    close(blochVector(applyGate(H, zeroState())), [1, 0, 0]);
    close(blochVector(applyGate(S, applyGate(H, zeroState()))), [0, 1, 0]);
  });
});

describe("states", () => {
  it("round-trip through (theta, phi)", () => {
    for (let i = 1; i < 20; i++) {
      const theta = (i / 20) * Math.PI;
      const phi = (i / 20) * 2 * Math.PI;
      const [t2, p2] = anglesFromState(stateFromAngles(theta, phi));
      expect(t2).toBeCloseTo(theta, 9);
      expect(p2).toBeCloseTo(phi, 9);
    }
  });

  it("agree with the closed-form Bloch vector", () => {
    close(blochVector(stateFromAngles(1.1, 2.2)), blochVectorFromAngles(1.1, 2.2));
  });

  it("ignore global phase and report phi = 0 at the poles", () => {
    const s = stateFromAngles(0.9, 1.3);
    const shifted: Vec2 = [
      {
        re: s[0].re * Math.cos(0.7) - s[0].im * Math.sin(0.7),
        im: s[0].re * Math.sin(0.7) + s[0].im * Math.cos(0.7),
      },
      {
        re: s[1].re * Math.cos(0.7) - s[1].im * Math.sin(0.7),
        im: s[1].re * Math.sin(0.7) + s[1].im * Math.cos(0.7),
      },
    ];
    close(anglesFromState(s), anglesFromState(shifted));
    expect(fidelity(s, shifted)).toBeCloseTo(1, 10);
    expect(anglesFromState(zeroState())).toEqual([0, 0]);
    expect(anglesFromState(oneState())[1]).toBe(0);
  });

  it("measure with the right probabilities and collapse", () => {
    const state = stateFromAngles(Math.PI / 3, 0.4); // p0 = 0.75
    close(measurementProbabilities(state), [0.75, 0.25]);
    const rand = mulberry32(7);
    let zeros = 0;
    const shots = 4000;
    for (let i = 0; i < shots; i++) {
      const { outcome, state: post } = measure(state, rand);
      close(blochVector(post), [0, 0, outcome === 0 ? 1 : -1]);
      if (outcome === 0) zeros++;
    }
    expect(Math.abs(zeros / shots - 0.75)).toBeLessThan(0.03);
  });
});

describe("purity", () => {
  it("links needle length and purity", () => {
    const r: Vec3 = [0.1, 0.2, 0.3];
    const purity = purityFromBloch(r);
    expect(purity).toBeCloseTo((1 + 0.14) / 2, 12);
    expect(blochLengthFromPurity(purity)).toBeCloseTo(Math.sqrt(0.14), 12);
    expect(blochLengthFromPurity(0.5)).toBe(0);
    expect(purityFromBloch(blochVector(stateFromAngles(0.8, 0.3)))).toBeCloseTo(1, 12);
  });
});

describe("parity with the Python engine", () => {
  const matrixFor = (name: string, angle: number | null): Mat2 => {
    switch (name) {
      case "X":
      case "Y":
      case "Z":
      case "H":
      case "S":
      case "T":
        return GATES[name];
      case "rx":
        return rx(angle ?? 0);
      case "ry":
        return ry(angle ?? 0);
      case "rz":
        return rz(angle ?? 0);
      default:
        throw new Error(`unknown gate ${name}`);
    }
  };

  it(`reproduces all ${cases.length} NumPy cases`, () => {
    expect(cases.length).toBeGreaterThan(0);
    for (const item of cases) {
      const state = stateFromAngles(item.theta, item.phi);
      close(blochVector(state), item.before);
      close(blochVector(applyGate(matrixFor(item.gate, item.angle), state)), item.after);
    }
  });
});
