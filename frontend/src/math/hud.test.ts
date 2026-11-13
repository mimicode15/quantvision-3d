import { describe, expect, it } from "vitest";
import {
  complexTex,
  densityMatrix,
  densityTex,
  diracTex,
  blochFromDensity,
  probabilities,
  purity,
  roundTo,
} from "./hud";
import {
  GATES,
  applyGate,
  blochVector,
  measurementProbabilities,
  oneState,
  stateFromAngles,
  zeroState,
  type Complex,
  type Mat2,
  type Vec2,
} from "./quantum";

const R = Math.SQRT1_2;
const z = (re: number, im = 0): Complex => ({ re, im });

/** Compare a matrix to expected [re, im] pairs. */
const expectMatrix = (m: Mat2, expected: number[][][], digits = 12) => {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const got = (m[i] as readonly Complex[])[j] as Complex;
      const want = (expected[i] as number[][])[j] as number[];
      expect(got.re).toBeCloseTo(want[0] as number, digits);
      expect(got.im).toBeCloseTo(want[1] as number, digits);
    }
  }
};

const sweep: Vec2[] = [];
for (let t = 0; t <= 12; t++) {
  for (let p = 0; p < 12; p++)
    sweep.push(stateFromAngles((t * Math.PI) / 12, (p * 2 * Math.PI) / 12));
}

describe("densityMatrix: known states", () => {
  it("|0> and |1> are the diagonal projectors", () => {
    expectMatrix(densityMatrix(zeroState()), [
      [
        [1, 0],
        [0, 0],
      ],
      [
        [0, 0],
        [0, 0],
      ],
    ]);
    expectMatrix(densityMatrix(oneState()), [
      [
        [0, 0],
        [0, 0],
      ],
      [
        [0, 0],
        [1, 0],
      ],
    ]);
  });

  it("|+> = (|0>+|1>)/sqrt2 has all entries 1/2", () => {
    expectMatrix(densityMatrix([z(R), z(R)]), [
      [
        [0.5, 0],
        [0.5, 0],
      ],
      [
        [0.5, 0],
        [0.5, 0],
      ],
    ]);
  });

  it("|-> has negative off-diagonals", () => {
    expectMatrix(densityMatrix([z(R), z(-R)]), [
      [
        [0.5, 0],
        [-0.5, 0],
      ],
      [
        [-0.5, 0],
        [0.5, 0],
      ],
    ]);
  });

  it("|+i> = (|0>+i|1>)/sqrt2 has rho01 = -i/2 and rho10 = +i/2", () => {
    expectMatrix(densityMatrix([z(R), z(0, R)]), [
      [
        [0.5, 0],
        [0, -0.5],
      ],
      [
        [0, 0.5],
        [0.5, 0],
      ],
    ]);
  });

  it("|-i> has rho01 = +i/2", () => {
    expectMatrix(densityMatrix([z(R), z(0, -R)]), [
      [
        [0.5, 0],
        [0, 0.5],
      ],
      [
        [0, -0.5],
        [0.5, 0],
      ],
    ]);
  });

  it("normalises its input", () => {
    expectMatrix(densityMatrix([z(2), z(0)]), [
      [
        [1, 0],
        [0, 0],
      ],
      [
        [0, 0],
        [0, 0],
      ],
    ]);
  });
});

describe("densityMatrix: invariants for every pure state", () => {
  it("is Hermitian with trace 1 and purity 1", () => {
    for (const s of sweep) {
      const m = densityMatrix(s);
      expect(m[0][0].re + m[1][1].re).toBeCloseTo(1, 12);
      expect(m[0][0].im).toBe(0);
      expect(m[1][1].im).toBe(0);
      expect(m[0][1].re).toBeCloseTo(m[1][0].re, 12);
      expect(m[0][1].im).toBeCloseTo(-m[1][0].im, 12);
      expect(purity(m)).toBeCloseTo(1, 12);
    }
  });

  it("is a projector: rho^2 = rho", () => {
    for (const s of sweep) {
      const m = densityMatrix(s);
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          let re = 0;
          let im = 0;
          for (let k = 0; k < 2; k++) {
            const p = (m[i] as readonly Complex[])[k] as Complex;
            const q = (m[k] as readonly Complex[])[j] as Complex;
            re += p.re * q.re - p.im * q.im;
            im += p.re * q.im + p.im * q.re;
          }
          const want = (m[i] as readonly Complex[])[j] as Complex;
          expect(re).toBeCloseTo(want.re, 12);
          expect(im).toBeCloseTo(want.im, 12);
        }
      }
    }
  });

  it("diagonal matches the measurement probabilities", () => {
    for (const s of sweep) {
      const [p0, p1] = probabilities(densityMatrix(s));
      const [q0, q1] = measurementProbabilities(s);
      expect(p0).toBeCloseTo(q0, 12);
      expect(p1).toBeCloseTo(q1, 12);
    }
  });

  it("gives the same Bloch vector the 3D scene uses", () => {
    for (const s of sweep) {
      const fromRho = blochFromDensity(densityMatrix(s));
      const fromState = blochVector(s);
      for (let k = 0; k < 3; k++)
        expect(fromRho[k] as number).toBeCloseTo(fromState[k] as number, 12);
    }
  });

  it("ignores global phase", () => {
    const s = stateFromAngles(1.1, 2.2);
    const alpha = 0.9;
    const phase = z(Math.cos(alpha), Math.sin(alpha));
    const mul = (a: Complex, b: Complex): Complex =>
      z(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
    expectMatrix(densityMatrix([mul(phase, s[0]), mul(phase, s[1])]), [
      [
        [densityMatrix(s)[0][0].re, 0],
        [densityMatrix(s)[0][1].re, densityMatrix(s)[0][1].im],
      ],
      [
        [densityMatrix(s)[1][0].re, densityMatrix(s)[1][0].im],
        [densityMatrix(s)[1][1].re, 0],
      ],
    ]);
  });

  it("stays a valid pure state after a chain of gates", () => {
    let s = zeroState();
    for (const g of [GATES.H, GATES.T, GATES.S, GATES.H, GATES.Y, GATES.T, GATES.X]) {
      s = applyGate(g, s);
      const m = densityMatrix(s);
      expect(m[0][0].re + m[1][1].re).toBeCloseTo(1, 12);
      expect(purity(m)).toBeCloseTo(1, 12);
    }
  });
});

describe("mixed states", () => {
  it("the maximally mixed state has purity 1/2 and Bloch vector 0", () => {
    const mixed: Mat2 = [
      [z(0.5), z(0)],
      [z(0), z(0.5)],
    ];
    expect(purity(mixed)).toBeCloseTo(0.5, 12);
    for (const component of blochFromDensity(mixed))
      expect(Math.abs(component)).toBeLessThan(1e-12);
  });

  it("purity and Bloch length agree: Tr rho^2 = (1 + |r|^2) / 2", () => {
    const rho: Mat2 = [
      [z(0.75), z(0.1, -0.2)],
      [z(0.1, 0.2), z(0.25)],
    ];
    const [x, y, zc] = blochFromDensity(rho);
    expect(purity(rho)).toBeCloseTo((1 + x * x + y * y + zc * zc) / 2, 12);
  });
});

describe("number formatting", () => {
  it("never prints negative zero", () => {
    expect(roundTo(-0.0004)).toBe(0);
    expect(Object.is(roundTo(-0.0004), -0)).toBe(false);
    expect(complexTex(z(-0.0004, -0.0004))).toBe("\\mathtt{0.000}");
  });

  it("formats real, imaginary and mixed values with fixed decimals", () => {
    expect(complexTex(z(0.5))).toBe("\\mathtt{0.500}");
    expect(complexTex(z(-0.25))).toBe("-\\mathtt{0.250}");
    expect(complexTex(z(0, 0.5))).toBe("\\mathtt{0.500i}");
    expect(complexTex(z(0, -0.5))).toBe("-\\mathtt{0.500i}");
    expect(complexTex(z(0.354, -0.354))).toBe("\\mathtt{0.354} - \\mathtt{0.354i}");
    expect(complexTex(z(-0.354, 0.354))).toBe("-\\mathtt{0.354} + \\mathtt{0.354i}");
  });

  it("rounds to the requested digits", () => {
    expect(complexTex(z(0.12349))).toBe("\\mathtt{0.123}");
    expect(complexTex(z(0.12351))).toBe("\\mathtt{0.124}");
    expect(complexTex(z(1 / 3), 2)).toBe("\\mathtt{0.33}");
  });
});

describe("diracTex", () => {
  it("names the basis states", () => {
    expect(diracTex(zeroState())).toBe("|\\psi\\rangle = |0\\rangle");
    expect(diracTex(oneState())).toBe("|\\psi\\rangle = |1\\rangle");
  });

  it("names the equator states and shows their amplitudes", () => {
    expect(diracTex(stateFromAngles(Math.PI / 2, 0))).toBe(
      "|\\psi\\rangle = |+\\rangle = \\mathtt{0.707}\\,|0\\rangle + \\mathtt{0.707}\\,|1\\rangle",
    );
    expect(diracTex(stateFromAngles(Math.PI / 2, Math.PI))).toBe(
      "|\\psi\\rangle = |{-}\\rangle = \\mathtt{0.707}\\,|0\\rangle - \\mathtt{0.707}\\,|1\\rangle",
    );
    expect(diracTex(stateFromAngles(Math.PI / 2, Math.PI / 2))).toContain("|+i\\rangle");
    expect(diracTex(stateFromAngles(Math.PI / 2, (3 * Math.PI) / 2))).toContain("|{-}i\\rangle");
  });

  it("writes the phase as e^{i phi} in degrees for general states", () => {
    expect(diracTex(stateFromAngles(Math.PI / 3, Math.PI / 4))).toBe(
      "|\\psi\\rangle = \\mathtt{0.866}\\,|0\\rangle + \\mathtt{0.500}\\,e^{i\\,\\mathtt{45.0}^\\circ}\\,|1\\rangle",
    );
  });

  it("drops the phase factor when phi is 0 and uses a minus sign at 180 degrees", () => {
    expect(diracTex(stateFromAngles(1, 0))).toContain("+ \\mathtt{");
    expect(diracTex(stateFromAngles(1, 0))).not.toContain("e^{");
    expect(diracTex(stateFromAngles(1, Math.PI))).toContain("- \\mathtt{");
  });

  it("treats a phi just below 360 degrees as 0, not 360.0", () => {
    const tex = diracTex(stateFromAngles(1, (359.97 * Math.PI) / 180));
    expect(tex).not.toContain("360.0");
    expect(tex).not.toContain("e^{");
  });

  it("is unaffected by global phase", () => {
    const s = stateFromAngles(0.8, 1.9);
    const g = z(Math.cos(1.3), Math.sin(1.3));
    const mul = (a: Complex, b: Complex): Complex =>
      z(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
    expect(diracTex([mul(g, s[0]), mul(g, s[1])])).toBe(diracTex(s));
  });
});

describe("densityTex", () => {
  it("writes |+> as a matrix of 0.500s", () => {
    expect(densityTex(densityMatrix([z(R), z(R)]))).toBe(
      "\\rho = \\begin{pmatrix} \\mathtt{0.500} & \\mathtt{0.500} \\\\ \\mathtt{0.500} & \\mathtt{0.500} \\end{pmatrix}",
    );
  });

  it("shows the coherence of |+i> as imaginary off-diagonals", () => {
    const tex = densityTex(densityMatrix([z(R), z(0, R)]));
    expect(tex).toContain("& -\\mathtt{0.500i} \\\\ \\mathtt{0.500i} &");
  });
});
