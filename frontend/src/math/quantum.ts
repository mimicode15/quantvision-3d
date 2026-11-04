/**
 * Single-qubit math for the browser. Mirrors backend/engine (same conventions
 * as Qiskit): |0> is +Z on the Bloch sphere, |+> is +X, |+i> is +Y.
 * Runs entirely client-side so the scene never waits on a network call.
 */

export interface Complex {
  re: number;
  im: number;
}
export type Vec2 = readonly [Complex, Complex];
export type Mat2 = readonly [readonly [Complex, Complex], readonly [Complex, Complex]];
export type Vec3 = readonly [number, number, number];

const TAU = 2 * Math.PI;
const EPS = 1e-12;
const POLE_TOL = 1e-9;

// ---- complex helpers ------------------------------------------------------
const c = (re: number, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex): Complex => c(a.re + b.re, a.im + b.im);
const mul = (a: Complex, b: Complex): Complex =>
  c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const conj = (a: Complex): Complex => c(a.re, -a.im);
const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im;
const expi = (phi: number): Complex => c(Math.cos(phi), Math.sin(phi));

// ---- gates ----------------------------------------------------------------
const R = Math.SQRT1_2;

export const IDENTITY: Mat2 = [
  [c(1), c(0)],
  [c(0), c(1)],
];
export const X: Mat2 = [
  [c(0), c(1)],
  [c(1), c(0)],
];
export const Y: Mat2 = [
  [c(0), c(0, -1)],
  [c(0, 1), c(0)],
];
export const Z: Mat2 = [
  [c(1), c(0)],
  [c(0), c(-1)],
];
export const H: Mat2 = [
  [c(R), c(R)],
  [c(R), c(-R)],
];
export const S: Mat2 = [
  [c(1), c(0)],
  [c(0), c(0, 1)],
];
export const T: Mat2 = [
  [c(1), c(0)],
  [c(0), expi(Math.PI / 4)],
];
export const GATES = { X, Y, Z, H, S, T } as const;

/** cos(angle/2) I - i sin(angle/2) pauli: rotation by `angle` about that Pauli's axis. */
function rotation(pauli: Mat2, angle: number): Mat2 {
  const cos = Math.cos(angle / 2);
  const minusISin = c(0, -Math.sin(angle / 2));
  const entry = (r: 0 | 1, k: 0 | 1): Complex =>
    add(c(r === k ? cos : 0), mul(minusISin, pauli[r][k]));
  return [
    [entry(0, 0), entry(0, 1)],
    [entry(1, 0), entry(1, 1)],
  ];
}
export const rx = (angle: number): Mat2 => rotation(X, angle);
export const ry = (angle: number): Mat2 => rotation(Y, angle);
export const rz = (angle: number): Mat2 => rotation(Z, angle);

export function matMul(a: Mat2, b: Mat2): Mat2 {
  const entry = (r: 0 | 1, k: 0 | 1): Complex => add(mul(a[r][0], b[0][k]), mul(a[r][1], b[1][k]));
  return [
    [entry(0, 0), entry(0, 1)],
    [entry(1, 0), entry(1, 1)],
  ];
}

/** True when m^dagger m equals the identity. */
export function isUnitary(m: Mat2, tol = 1e-10): boolean {
  for (const i of [0, 1] as const) {
    for (const j of [0, 1] as const) {
      let sum = c(0);
      for (const k of [0, 1] as const) sum = add(sum, mul(conj(m[k][i]), m[k][j]));
      const target = i === j ? 1 : 0;
      if (Math.abs(sum.re - target) > tol || Math.abs(sum.im) > tol) return false;
    }
  }
  return true;
}

export function applyGate(m: Mat2, v: Vec2): Vec2 {
  return [add(mul(m[0][0], v[0]), mul(m[0][1], v[1])), add(mul(m[1][0], v[0]), mul(m[1][1], v[1]))];
}

// ---- states ---------------------------------------------------------------
export const zeroState = (): Vec2 => [c(1), c(0)];
export const oneState = (): Vec2 => [c(0), c(1)];

export function normalize(v: Vec2): Vec2 {
  const norm = Math.sqrt(abs2(v[0]) + abs2(v[1]));
  if (norm < EPS) throw new Error("cannot normalize the zero vector");
  return [c(v[0].re / norm, v[0].im / norm), c(v[1].re / norm, v[1].im / norm)];
}

/** cos(theta/2)|0> + e^{i phi} sin(theta/2)|1> */
export function stateFromAngles(theta: number, phi: number): Vec2 {
  const s = Math.sin(theta / 2);
  const e = expi(phi);
  return [c(Math.cos(theta / 2)), c(e.re * s, e.im * s)];
}

/** Returns [theta, phi]; global phase is discarded and phi is 0 at the poles. */
export function anglesFromState(v: Vec2): [number, number] {
  const [a, b] = normalize(v);
  const ma = Math.hypot(a.re, a.im);
  const mb = Math.hypot(b.re, b.im);
  const theta = 2 * Math.atan2(mb, ma);
  if (ma < POLE_TOL || mb < POLE_TOL) return [theta, 0];
  const phi = Math.atan2(b.im, b.re) - Math.atan2(a.im, a.re);
  return [theta, ((phi % TAU) + TAU) % TAU];
}

/** |<a|b>|^2: 1 means identical up to global phase. */
export function fidelity(a: Vec2, b: Vec2): number {
  const [na, nb] = [normalize(a), normalize(b)];
  const inner = add(mul(conj(na[0]), nb[0]), mul(conj(na[1]), nb[1]));
  return abs2(inner);
}

// ---- Bloch sphere, purity, measurement -------------------------------------
/** (Tr(rho X), Tr(rho Y), Tr(rho Z)) for a pure state, via amplitudes. */
export function blochVector(v: Vec2): Vec3 {
  const [a, b] = normalize(v);
  const ab = mul(conj(a), b);
  return [2 * ab.re, 2 * ab.im, abs2(a) - abs2(b)];
}

export function blochVectorFromAngles(theta: number, phi: number): Vec3 {
  return [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];
}

/** Tr(rho^2) = (1 + |r|^2) / 2 for a qubit with Bloch vector r. */
export function purityFromBloch(r: Vec3): number {
  return (1 + r[0] * r[0] + r[1] * r[1] + r[2] * r[2]) / 2;
}

/** |r| = sqrt(2 Tr(rho^2) - 1): the length of the needle under noise. */
export function blochLengthFromPurity(purity: number): number {
  return Math.sqrt(Math.max(2 * purity - 1, 0));
}

export function measurementProbabilities(v: Vec2): [number, number] {
  const [a] = normalize(v);
  const p0 = abs2(a);
  return [p0, 1 - p0];
}

/** Z-basis measurement. `random` must return a number in [0, 1). */
export function measure(
  v: Vec2,
  random: () => number = Math.random,
): { outcome: 0 | 1; state: Vec2 } {
  const [p0] = measurementProbabilities(v);
  return random() < p0 ? { outcome: 0, state: zeroState() } : { outcome: 1, state: oneState() };
}
