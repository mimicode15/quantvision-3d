import type { Mat2, Vec3 } from "./quantum";

// Same model as backend/engine/decoherence.py. Time units don't matter as long as
// t, T1 and T2 all use the same ones (the sliders use microseconds).
//   x, y shrink by exp(-t/T2)
//   z relaxes toward +1 (|0>) with exp(-t/T1)

export interface Noise {
  t: number;
  t1: number;
  t2: number;
}

const SLACK = 1e-9;

/** Physics says T2 can't be longer than 2*T1. */
export const t2WithinLimit = (t1: number, t2: number): boolean => t2 <= 2 * t1 * (1 + SLACK);

/** The biggest T2 allowed for this T1. */
export const clampT2 = (t1: number, t2: number): number => Math.min(t2, 2 * t1);

function check({ t, t1, t2 }: Noise): void {
  if (![t, t1, t2].every(Number.isFinite)) throw new RangeError("t, T1 and T2 must be finite");
  if (t < 0) throw new RangeError("t must be >= 0");
  if (t1 <= 0 || t2 <= 0) throw new RangeError("T1 and T2 must be > 0");
  if (!t2WithinLimit(t1, t2)) throw new RangeError("T2 cannot exceed 2*T1");
}

/** How much excited population and how much coherence is left after time t. */
export function survival(noise: Noise): { population: number; coherence: number } {
  check(noise);
  return {
    population: Math.exp(-noise.t / noise.t1),
    coherence: Math.exp(-noise.t / noise.t2),
  };
}

/** The Bloch vector after the qubit has been left alone for time t. */
export function evolveBloch(r: Vec3, noise: Noise): Vec3 {
  const { population, coherence } = survival(noise);
  return [r[0] * coherence, r[1] * coherence, 1 + (r[2] - 1) * population];
}

/** rho = (I + x X + y Y + z Z) / 2 */
export function densityFromBloch([x, y, z]: Vec3): Mat2 {
  return [
    [
      { re: (1 + z) / 2, im: 0 },
      { re: x / 2, im: -y / 2 },
    ],
    [
      { re: x / 2, im: y / 2 },
      { re: (1 - z) / 2, im: 0 },
    ],
  ];
}

/** Short plain-English line for the panel under the sliders. */
export function describePurity(purity: number): string {
  const p = purity.toFixed(2);
  if (purity > 0.999) return `Purity ${p}: still a pure state.`;
  if (purity > 0.9) return `Purity ${p}: slightly mixed.`;
  if (purity > 0.6) return `Purity ${p}: partly mixed.`;
  if (purity > 0.51) return `Purity ${p}: almost completely mixed.`;
  return `Purity ${p}: completely mixed, nothing left to read.`;
}
