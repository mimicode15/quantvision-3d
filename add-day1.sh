#!/usr/bin/env bash
# QuantVision Day 1: single-qubit math engine (Python + TypeScript) with tests.
# Run from the REPO ROOT (the folder that contains backend/ and frontend/).
set -euo pipefail

[ -d backend ] && [ -d frontend ] || { echo "Run this from ~/projects/quantvision-3d"; exit 1; }
[ -f backend/.venv/bin/activate ] || { echo "backend/.venv is missing"; exit 1; }

mkdir -p backend/scripts shared/fixtures frontend/src/math

# =====================================================================
# backend/engine/gates.py
# =====================================================================
cat > backend/engine/gates.py <<'EOF'
"""Single-qubit gates as 2x2 complex NumPy matrices.

Conventions (identical to Qiskit):
  * Computational basis: |0> = [1, 0], |1> = [0, 1].
  * |0> is the north pole (+Z) of the Bloch sphere and |1> the south pole (-Z).
  * |+> = (|0> + |1>)/sqrt(2) sits on +X, |+i> = (|0> + i|1>)/sqrt(2) on +Y.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

Matrix = NDArray[np.complex128]
State = NDArray[np.complex128]

IDENTITY: Matrix = np.eye(2, dtype=np.complex128)
X: Matrix = np.array([[0, 1], [1, 0]], dtype=np.complex128)
Y: Matrix = np.array([[0, -1j], [1j, 0]], dtype=np.complex128)
Z: Matrix = np.array([[1, 0], [0, -1]], dtype=np.complex128)
H: Matrix = np.array([[1, 1], [1, -1]], dtype=np.complex128) / np.sqrt(2)
S: Matrix = np.array([[1, 0], [0, 1j]], dtype=np.complex128)
T: Matrix = np.array([[1, 0], [0, np.exp(1j * np.pi / 4)]], dtype=np.complex128)

GATES: dict[str, Matrix] = {"I": IDENTITY, "X": X, "Y": Y, "Z": Z, "H": H, "S": S, "T": T}


def rotation(pauli: Matrix, angle: float) -> Matrix:
    """Rotation exp(-i * angle/2 * pauli) = cos(angle/2) I - i sin(angle/2) pauli.

    On the Bloch sphere this rotates the state vector by `angle` radians about
    the axis that `pauli` represents.
    """
    return np.cos(angle / 2) * IDENTITY - 1j * np.sin(angle / 2) * pauli


def rx(angle: float) -> Matrix:
    return rotation(X, angle)


def ry(angle: float) -> Matrix:
    return rotation(Y, angle)


def rz(angle: float) -> Matrix:
    return rotation(Z, angle)


def is_unitary(matrix: Matrix, atol: float = 1e-10) -> bool:
    """True when matrix^dagger @ matrix equals the identity."""
    return bool(np.allclose(matrix.conj().T @ matrix, IDENTITY, atol=atol))


def apply_gate(gate: Matrix, state: State) -> State:
    return gate @ state
EOF

# =====================================================================
# backend/engine/state.py
# =====================================================================
cat > backend/engine/state.py <<'EOF'
"""Pure states, density matrices and Bloch-sphere coordinates for one qubit.

A pure state with polar angle theta in [0, pi] and azimuth phi in [0, 2*pi) is

    |psi> = cos(theta/2)|0> + e^{i phi} sin(theta/2)|1>

and its Bloch vector is (sin(t)cos(p), sin(t)sin(p), cos(t)).
A mixed state has density matrix rho = (I + x X + y Y + z Z) / 2 with |r| <= 1.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

from .gates import IDENTITY, X, Y, Z

Matrix = NDArray[np.complex128]
State = NDArray[np.complex128]
Vector3 = NDArray[np.float64]

_EPS = 1e-12
_POLE_TOL = 1e-9


def zero_state() -> State:
    return np.array([1, 0], dtype=np.complex128)


def one_state() -> State:
    return np.array([0, 1], dtype=np.complex128)


def normalize(state: State) -> State:
    norm = np.linalg.norm(state)
    if norm < _EPS:
        raise ValueError("cannot normalize the zero vector")
    return np.asarray(state / norm, dtype=np.complex128)


def state_from_angles(theta: float, phi: float) -> State:
    return np.array(
        [np.cos(theta / 2), np.exp(1j * phi) * np.sin(theta / 2)],
        dtype=np.complex128,
    )


def angles_from_state(state: State) -> tuple[float, float]:
    """Return (theta, phi). The global phase is discarded.

    At the poles phi has no meaning, so it is reported as 0.
    """
    a, b = normalize(state)
    theta = 2 * np.arctan2(abs(b), abs(a))
    if abs(a) < _POLE_TOL or abs(b) < _POLE_TOL:
        return float(theta), 0.0
    phi = (np.angle(b) - np.angle(a)) % (2 * np.pi)
    return float(theta), float(phi)


def fidelity(a: State, b: State) -> float:
    """|<a|b>|^2 for two pure states; 1.0 means identical up to global phase."""
    return float(abs(np.vdot(normalize(a), normalize(b))) ** 2)


def density_matrix(state: State) -> Matrix:
    s = normalize(state)
    return np.outer(s, s.conj())


def bloch_vector(rho: Matrix) -> Vector3:
    """(Tr(rho X), Tr(rho Y), Tr(rho Z)), valid for pure and mixed states."""
    return np.array(
        [np.trace(rho @ X).real, np.trace(rho @ Y).real, np.trace(rho @ Z).real],
        dtype=np.float64,
    )


def bloch_vector_from_state(state: State) -> Vector3:
    return bloch_vector(density_matrix(state))


def bloch_vector_from_angles(theta: float, phi: float) -> Vector3:
    return np.array(
        [np.sin(theta) * np.cos(phi), np.sin(theta) * np.sin(phi), np.cos(theta)],
        dtype=np.float64,
    )


def density_from_bloch(vector: Vector3) -> Matrix:
    x, y, z = vector
    return (IDENTITY + x * X + y * Y + z * Z) / 2


def purity(rho: Matrix) -> float:
    """Tr(rho^2): 1 for a pure state, 1/2 for the maximally mixed qubit."""
    return float(np.trace(rho @ rho).real)


def bloch_length_from_purity(p: float) -> float:
    """|r| = sqrt(2 Tr(rho^2) - 1). This is how far the needle shrinks under noise."""
    return float(np.sqrt(max(2 * p - 1, 0.0)))


def measurement_probabilities(state: State) -> tuple[float, float]:
    s = normalize(state)
    p0 = float(abs(s[0]) ** 2)
    return p0, 1.0 - p0


def measure(state: State, rng: np.random.Generator) -> tuple[int, State]:
    """Projective Z-basis measurement. Returns (outcome, collapsed state)."""
    p0, _ = measurement_probabilities(state)
    if rng.random() < p0:
        return 0, zero_state()
    return 1, one_state()
EOF

# =====================================================================
# backend/tests/test_engine.py
# =====================================================================
cat > backend/tests/test_engine.py <<'EOF'
"""Sanity tests for the NumPy quantum engine (Qiskit cross-checks arrive on Day 2)."""

import numpy as np
import pytest

from engine.gates import (
    GATES,
    IDENTITY,
    H,
    S,
    T,
    X,
    Y,
    Z,
    apply_gate,
    is_unitary,
    rx,
    ry,
    rz,
)
from engine.state import (
    angles_from_state,
    bloch_length_from_purity,
    bloch_vector,
    bloch_vector_from_angles,
    bloch_vector_from_state,
    density_from_bloch,
    density_matrix,
    fidelity,
    measure,
    measurement_probabilities,
    normalize,
    one_state,
    purity,
    state_from_angles,
    zero_state,
)


def random_state(rng: np.random.Generator):
    return normalize(rng.normal(size=2) + 1j * rng.normal(size=2))


RNG = np.random.default_rng(1234)
RANDOM_STATES = [random_state(RNG) for _ in range(25)]
C45 = np.cos(np.pi / 4)
S45 = np.sin(np.pi / 4)

# How each fixed gate must move a Bloch vector (x, y, z).
BLOCH_ACTION = {
    "X": lambda x, y, z: (x, -y, -z),
    "Y": lambda x, y, z: (-x, y, -z),
    "Z": lambda x, y, z: (-x, -y, z),
    "H": lambda x, y, z: (z, -y, x),
    "S": lambda x, y, z: (-y, x, z),
    "T": lambda x, y, z: (C45 * x - S45 * y, S45 * x + C45 * y, z),
}


@pytest.mark.parametrize("name", list(GATES))
def test_fixed_gates_are_unitary(name):
    assert is_unitary(GATES[name])


@pytest.mark.parametrize("angle", [-3.0, -0.5, 0.0, 0.7, np.pi, 5.1])
@pytest.mark.parametrize("builder", [rx, ry, rz])
def test_rotation_gates_are_unitary(builder, angle):
    assert is_unitary(builder(angle))


def test_matrix_identities():
    assert np.allclose(X @ Y, 1j * Z)
    assert np.allclose(H @ Z @ H, X)
    assert np.allclose(H @ X @ H, Z)
    assert np.allclose(H @ H, IDENTITY)
    assert np.allclose(X @ X, IDENTITY)
    assert np.allclose(S @ S, Z)
    assert np.allclose(T @ T, S)


def test_rotation_special_cases():
    assert np.allclose(rx(np.pi), -1j * X)
    assert np.allclose(ry(np.pi), -1j * Y)
    assert np.allclose(rz(np.pi), -1j * Z)
    assert np.allclose(rx(0), IDENTITY)
    # S equals Rz(pi/2) up to a global phase of e^{i pi/4}
    assert np.allclose(S, np.exp(1j * np.pi / 4) * rz(np.pi / 2))


def test_basis_actions():
    plus = np.array([1, 1], dtype=complex) / np.sqrt(2)
    assert np.allclose(apply_gate(X, zero_state()), one_state())
    assert np.allclose(apply_gate(H, zero_state()), plus)
    assert np.allclose(apply_gate(H, one_state()), np.array([1, -1]) / np.sqrt(2))


@pytest.mark.parametrize("name", list(BLOCH_ACTION))
def test_gates_rotate_the_bloch_vector(name):
    for state in RANDOM_STATES:
        before = bloch_vector_from_state(state)
        after = bloch_vector_from_state(apply_gate(GATES[name], state))
        assert np.allclose(after, BLOCH_ACTION[name](*before), atol=1e-12)


def test_rotation_gates_move_the_bloch_vector_by_the_angle():
    for angle in [0.3, 1.2, 2.5, -0.8]:
        up = zero_state()
        plus = apply_gate(H, zero_state())
        assert np.allclose(
            bloch_vector_from_state(apply_gate(rx(angle), up)),
            [0, -np.sin(angle), np.cos(angle)],
        )
        assert np.allclose(
            bloch_vector_from_state(apply_gate(ry(angle), up)),
            [np.sin(angle), 0, np.cos(angle)],
        )
        assert np.allclose(
            bloch_vector_from_state(apply_gate(rz(angle), plus)),
            [np.cos(angle), np.sin(angle), 0],
        )


def test_angles_roundtrip():
    rng = np.random.default_rng(5)
    for _ in range(200):
        theta = rng.uniform(0.05, np.pi - 0.05)
        phi = rng.uniform(0, 2 * np.pi)
        theta2, phi2 = angles_from_state(state_from_angles(theta, phi))
        assert theta2 == pytest.approx(theta, abs=1e-9)
        assert phi2 == pytest.approx(phi, abs=1e-9)


def test_poles():
    assert angles_from_state(zero_state()) == (0.0, 0.0)
    theta, phi = angles_from_state(one_state())
    assert theta == pytest.approx(np.pi)
    assert phi == 0.0


def test_global_phase_is_ignored():
    for state in RANDOM_STATES:
        shifted = np.exp(1j * 0.7) * state
        assert np.allclose(angles_from_state(state), angles_from_state(shifted))
        assert fidelity(state, shifted) == pytest.approx(1.0)


def test_bloch_vector_matches_closed_form():
    rng = np.random.default_rng(9)
    for _ in range(50):
        theta, phi = rng.uniform(0, np.pi), rng.uniform(0, 2 * np.pi)
        from_state = bloch_vector_from_state(state_from_angles(theta, phi))
        assert np.allclose(from_state, bloch_vector_from_angles(theta, phi), atol=1e-12)


def test_density_matrix_of_pure_states():
    for state in RANDOM_STATES:
        rho = density_matrix(state)
        assert np.trace(rho) == pytest.approx(1.0)
        assert np.allclose(rho, rho.conj().T)
        assert np.linalg.eigvalsh(rho).min() > -1e-12
        assert np.allclose(rho @ rho, rho)  # projector
        assert purity(rho) == pytest.approx(1.0)
        assert np.linalg.norm(bloch_vector(rho)) == pytest.approx(1.0)


def test_mixed_states_shrink_the_bloch_vector():
    vec = np.array([0.1, 0.2, 0.3])
    rho = density_from_bloch(vec)
    assert np.allclose(bloch_vector(rho), vec)
    assert purity(rho) == pytest.approx((1 + vec @ vec) / 2)
    assert bloch_length_from_purity(purity(rho)) == pytest.approx(np.linalg.norm(vec))

    maximally_mixed = density_from_bloch(np.zeros(3))
    assert purity(maximally_mixed) == pytest.approx(0.5)
    assert bloch_length_from_purity(0.5) == 0.0


def test_measurement_probabilities():
    p0, p1 = measurement_probabilities(apply_gate(H, zero_state()))
    assert (p0, p1) == (pytest.approx(0.5), pytest.approx(0.5))
    for state in RANDOM_STATES:
        assert sum(measurement_probabilities(state)) == pytest.approx(1.0)
    # unnormalised input is normalised first
    assert measurement_probabilities(np.array([3, 4j]))[0] == pytest.approx(9 / 25)


def test_measure_collapses_with_the_right_statistics():
    rng = np.random.default_rng(7)
    state = state_from_angles(np.pi / 3, 0.4)  # p0 = cos^2(pi/6) = 0.75
    zeros = 0
    shots = 4000
    for _ in range(shots):
        outcome, post = measure(state, rng)
        assert np.allclose(post, zero_state() if outcome == 0 else one_state())
        zeros += outcome == 0
    assert zeros / shots == pytest.approx(0.75, abs=0.03)


def test_normalize_rejects_the_zero_vector():
    with pytest.raises(ValueError):
        normalize(np.zeros(2, dtype=complex))
EOF

# =====================================================================
# backend/scripts/export_fixtures.py  (shared test cases for the TS tests)
# =====================================================================
cat > backend/scripts/export_fixtures.py <<'EOF'
"""Write cross-language test cases that the TypeScript tests must reproduce.

Run from backend/:  python -m scripts.export_fixtures
"""

import json
from pathlib import Path

import numpy as np

from engine.gates import GATES, apply_gate, rx, ry, rz
from engine.state import bloch_vector_from_state, state_from_angles

OUT = Path(__file__).resolve().parents[2] / "shared" / "fixtures" / "gate_cases.json"
ROTATIONS = {"rx": rx, "ry": ry, "rz": rz}


def main() -> None:
    rng = np.random.default_rng(2024)
    cases = []
    for _ in range(12):
        theta = float(rng.uniform(0, np.pi))
        phi = float(rng.uniform(0, 2 * np.pi))
        state = state_from_angles(theta, phi)
        before = bloch_vector_from_state(state).tolist()
        for name in ("X", "Y", "Z", "H", "S", "T"):
            after = bloch_vector_from_state(apply_gate(GATES[name], state)).tolist()
            cases.append(
                {
                    "gate": name,
                    "angle": None,
                    "theta": theta,
                    "phi": phi,
                    "before": before,
                    "after": after,
                }
            )
        for name, builder in ROTATIONS.items():
            angle = float(rng.uniform(-np.pi, np.pi))
            after = bloch_vector_from_state(apply_gate(builder(angle), state)).tolist()
            cases.append(
                {
                    "gate": name,
                    "angle": angle,
                    "theta": theta,
                    "phi": phi,
                    "before": before,
                    "after": after,
                }
            )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(cases, indent=2) + "\n")
    print(f"wrote {len(cases)} cases to {OUT}")


if __name__ == "__main__":
    main()
EOF

# =====================================================================
# frontend/src/math/quantum.ts
# =====================================================================
cat > frontend/src/math/quantum.ts <<'EOF'
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
  const entry = (r: 0 | 1, k: 0 | 1): Complex =>
    add(mul(a[r][0], b[0][k]), mul(a[r][1], b[1][k]));
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
export function measure(v: Vec2, random: () => number = Math.random): { outcome: 0 | 1; state: Vec2 } {
  const [p0] = measurementProbabilities(v);
  return random() < p0
    ? { outcome: 0, state: zeroState() }
    : { outcome: 1, state: oneState() };
}
EOF

# =====================================================================
# frontend/src/math/quantum.test.ts
# =====================================================================
cat > frontend/src/math/quantum.test.ts <<'EOF'
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
      { re: s[0].re * Math.cos(0.7) - s[0].im * Math.sin(0.7), im: s[0].re * Math.sin(0.7) + s[0].im * Math.cos(0.7) },
      { re: s[1].re * Math.cos(0.7) - s[1].im * Math.sin(0.7), im: s[1].re * Math.sin(0.7) + s[1].im * Math.cos(0.7) },
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
EOF

# =====================================================================
# frontend config: JSON imports + test script, then install vitest
# =====================================================================
cat > frontend/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "types": ["vite/client"],
    "skipLibCheck": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
EOF

echo "== backend: format, lint, test, export fixtures =="
# shellcheck disable=SC1091
source backend/.venv/bin/activate
( cd backend && ruff check --fix . && ruff format . && pytest -q && python -m scripts.export_fixtures )

echo "== frontend: install vitest, format, typecheck, lint, test =="
(
  cd frontend
  npm install -D vitest
  npm pkg set scripts.test="vitest run" scripts.test:watch="vitest"
  npm run format
  npm run typecheck
  npm run lint
  npm test
)

echo
echo "Day 1 complete: all checks passed."
echo "Next: git add -A && git commit -m 'feat: day 1 single-qubit math engine (NumPy + TypeScript)' && git push"
