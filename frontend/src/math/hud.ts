/**
 * Everything the math HUD needs, as pure functions: the density matrix, its invariants, and
 * the LaTeX strings. Kept free of the DOM so it can be tested against known values.
 * Takes a general 2x2 density matrix (not just a pure state) so Day 7's noisy states can reuse it.
 */
import {
  anglesFromState,
  normalize,
  type Complex,
  type Mat2,
  type Vec2,
  type Vec3,
} from "./quantum";

const DEG = 180 / Math.PI;

// ---- density matrix -------------------------------------------------------
/** rho = |psi><psi|. Global phase cancels, so equal states give equal matrices. */
export function densityMatrix(state: Vec2): Mat2 {
  const [a, b] = normalize(state);
  const ab: Complex = { re: a.re * b.re + a.im * b.im, im: a.im * b.re - a.re * b.im }; // a * conj(b)
  return [
    [{ re: a.re * a.re + a.im * a.im, im: 0 }, ab],
    [
      { re: ab.re, im: -ab.im },
      { re: b.re * b.re + b.im * b.im, im: 0 },
    ],
  ];
}

/** Tr(rho^2): 1 for a pure state, 1/2 for the maximally mixed state. */
export function purity(rho: Mat2): number {
  let sum = 0;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const p = (rho[i] as readonly Complex[])[j] as Complex;
      const q = (rho[j] as readonly Complex[])[i] as Complex;
      sum += p.re * q.re - p.im * q.im; // real part of rho_ij * rho_ji
    }
  }
  return sum;
}

/** [P(0), P(1)]: the diagonal of rho. */
export function probabilities(rho: Mat2): [number, number] {
  return [rho[0][0].re, rho[1][1].re];
}

/** (Tr rho X, Tr rho Y, Tr rho Z). Length 1 for pure states, shorter for mixed ones. */
export function blochFromDensity(rho: Mat2): Vec3 {
  const off = rho[0][1];
  return [2 * off.re, -2 * off.im, rho[0][0].re - rho[1][1].re];
}

// ---- number and LaTeX formatting -------------------------------------------
/** Rounds and removes negative zero, so -0.0004 never prints as "-0.000". */
export function roundTo(x: number, digits = 3): number {
  const r = Number(x.toFixed(digits));
  return r === 0 ? 0 : r;
}

/** Digits go in \mathtt so the HUD can set them in Syne Mono and the columns line up. */
const mono = (text: string): string => `\\mathtt{${text}}`;

/** LaTeX for one complex number, at fixed decimals: 0.354, -0.250i, 0.354 - 0.354i. */
export function complexTex(z: Complex, digits = 3): string {
  const re = roundTo(z.re, digits);
  const im = roundTo(z.im, digits);
  const reText = mono(Math.abs(re).toFixed(digits));
  const imText = mono(`${Math.abs(im).toFixed(digits)}i`);
  if (im === 0) return `${re < 0 ? "-" : ""}${reText}`;
  if (re === 0) return `${im < 0 ? "-" : ""}${imText}`;
  return `${re < 0 ? "-" : ""}${reText} ${im < 0 ? "-" : "+"} ${imText}`;
}

/** The general single-qubit state: the formula behind every number the HUD shows. */
export const GENERAL_STATE_TEX =
  "|\\psi\\rangle = \\cos\\tfrac{\\theta}{2}\\,|0\\rangle + e^{i\\varphi}\\sin\\tfrac{\\theta}{2}\\,|1\\rangle";

const near = (value: number, target: number, tolerance = 0.05): boolean =>
  Math.abs(value - target) < tolerance;

/**
 * |psi> with real numbers: cos(theta/2)|0> + sin(theta/2) e^{i phi}|1>, up to global phase.
 * Basis and equator states also get their names (|0>, |+>, |-i>, ...).
 */
export function diracTex(state: Vec2): string {
  const [theta, phi] = anglesFromState(state);
  const thetaDeg = theta * DEG;
  const ket = "|\\psi\\rangle";

  if (near(thetaDeg, 0)) return `${ket} = |0\\rangle`;
  if (near(thetaDeg, 180)) return `${ket} = |1\\rangle`;

  const amp0 = mono(Math.cos(theta / 2).toFixed(3));
  const amp1 = mono(Math.sin(theta / 2).toFixed(3));
  const phiDeg = (((roundTo(phi * DEG, 1) % 360) + 360) % 360) as number;

  let one: string;
  if (phiDeg === 0) one = `+ ${amp1}\\,|1\\rangle`;
  else if (phiDeg === 180) one = `- ${amp1}\\,|1\\rangle`;
  else one = `+ ${amp1}\\,e^{i\\,${mono(phiDeg.toFixed(1))}^\\circ}\\,|1\\rangle`;
  const numeric = `${amp0}\\,|0\\rangle ${one}`;

  if (near(thetaDeg, 90)) {
    const name =
      phiDeg === 0
        ? "+"
        : phiDeg === 180
          ? "{-}"
          : phiDeg === 90
            ? "+i"
            : phiDeg === 270
              ? "{-}i"
              : null;
    if (name) return `${ket} = |${name}\\rangle = ${numeric}`;
  }
  return `${ket} = ${numeric}`;
}

/** rho as a 2x2 matrix of fixed-decimal complex numbers. */
export function densityTex(rho: Mat2): string {
  const [[r00, r01], [r10, r11]] = rho;
  return (
    "\\rho = \\begin{pmatrix} " +
    `${complexTex(r00)} & ${complexTex(r01)} \\\\ ${complexTex(r10)} & ${complexTex(r11)}` +
    " \\end{pmatrix}"
  );
}
