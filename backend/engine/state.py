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
