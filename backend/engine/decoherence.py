"""Single-qubit noise: T1 relaxation (amplitude damping) and T2 dephasing.

The qubit relaxes toward the ground state |0>, the north pole (+Z). With t the
elapsed time (same units as T1 and T2), the Bloch vector (x, y, z) evolves as

    x(t) = x0 * exp(-t / T2)
    y(t) = y0 * exp(-t / T2)
    z(t) = 1 + (z0 - 1) * exp(-t / T1)

Physical limit: 1/T2 = 1/(2 T1) + 1/T_phi and 1/T_phi >= 0, so T2 <= 2 T1.

The same physics as quantum channels (Kraus operators): amplitude damping with
gamma = 1 - exp(-t/T1), then phase damping with lambda = 1 - exp(-2t/T_phi).
(Phase damping keeps sqrt(1 - lambda) of the coherence, so lambda needs the 2t to
leave exactly exp(-t/T_phi).)
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np
from numpy.typing import NDArray

Matrix = NDArray[np.complex128]
Vector3 = NDArray[np.float64]

_SLACK = 1e-9  # tolerance when checking T2 <= 2*T1


@dataclass(frozen=True)
class DecayParameters:
    t: float
    t1: float
    t2: float
    t_phi: float | None  # pure-dephasing time; None when T2 = 2*T1 (no extra dephasing)
    population_factor: float  # exp(-t/T1): how much excited-state population is left
    coherence_factor: float  # exp(-t/T2): how much of x and y is left
    amplitude_damping_gamma: float  # 1 - exp(-t/T1)
    phase_damping_lambda: float  # 1 - exp(-2t/T_phi)

    def as_dict(self) -> dict[str, float | None]:
        return asdict(self)


def t2_within_limit(t1: float, t2: float) -> bool:
    """True when T2 <= 2*T1, the physical upper bound."""
    return t2 <= 2 * t1 * (1 + _SLACK)


def decay_parameters(t: float, t1: float, t2: float) -> DecayParameters:
    if not all(math.isfinite(v) for v in (t, t1, t2)):
        raise ValueError("t, T1 and T2 must be finite numbers")
    if t < 0:
        raise ValueError("t must be >= 0")
    if t1 <= 0 or t2 <= 0:
        raise ValueError("T1 and T2 must be > 0")
    if not t2_within_limit(t1, t2):
        raise ValueError("T2 cannot exceed 2*T1 (physical limit)")

    inv_t_phi = max(1 / t2 - 1 / (2 * t1), 0.0)
    has_pure_dephasing = inv_t_phi > 1e-12 / t2
    t_phi = 1 / inv_t_phi if has_pure_dephasing else None
    phase_lambda = -math.expm1(-2 * t * inv_t_phi) if has_pure_dephasing else 0.0

    return DecayParameters(
        t=t,
        t1=t1,
        t2=t2,
        t_phi=t_phi,
        population_factor=math.exp(-t / t1),
        coherence_factor=math.exp(-t / t2),
        amplitude_damping_gamma=-math.expm1(-t / t1),
        phase_damping_lambda=phase_lambda,
    )


def _check_probability(p: float, name: str) -> None:
    if not 0.0 <= p <= 1.0:
        raise ValueError(f"{name} must be between 0 and 1, got {p}")


def _amplitude_damping(keep: float, lose: float) -> list[Matrix]:
    """Kraus pair with keep = sqrt(1 - gamma) and lose = sqrt(gamma)."""
    return [
        np.array([[1, 0], [0, keep]], dtype=np.complex128),
        np.array([[0, lose], [0, 0]], dtype=np.complex128),
    ]


def _phase_damping(keep: float, lose: float) -> list[Matrix]:
    """Kraus pair with keep = sqrt(1 - lambda) and lose = sqrt(lambda)."""
    return [
        np.array([[1, 0], [0, keep]], dtype=np.complex128),
        np.array([[0, 0], [0, lose]], dtype=np.complex128),
    ]


def amplitude_damping_kraus(gamma: float) -> list[Matrix]:
    _check_probability(gamma, "gamma")
    return _amplitude_damping(math.sqrt(1 - gamma), math.sqrt(gamma))


def phase_damping_kraus(lam: float) -> list[Matrix]:
    _check_probability(lam, "lambda")
    return _phase_damping(math.sqrt(1 - lam), math.sqrt(lam))


def apply_channel(rho: Matrix, kraus: list[Matrix]) -> Matrix:
    """rho -> sum_k K rho K^dagger"""
    out = np.zeros((2, 2), dtype=np.complex128)
    for k in kraus:
        out += k @ rho @ k.conj().T
    return out


def evolve_density(rho: Matrix, t: float, t1: float, t2: float) -> Matrix:
    """Let `rho` decohere for time t: amplitude damping, then phase damping."""
    p = decay_parameters(t, t1, t2)
    # Built from the survival factors directly: 1 - gamma and 1 - lambda lose precision
    # when gamma or lambda round to 1 (long times), the factors themselves do not.
    rho = apply_channel(
        rho,
        _amplitude_damping(math.sqrt(p.population_factor), math.sqrt(p.amplitude_damping_gamma)),
    )
    if p.t_phi is None:
        return rho
    return apply_channel(
        rho, _phase_damping(math.exp(-t / p.t_phi), math.sqrt(p.phase_damping_lambda))
    )


def evolve_bloch(vector: Vector3, t: float, t1: float, t2: float) -> Vector3:
    """Closed-form version of evolve_density, acting directly on the Bloch vector."""
    p = decay_parameters(t, t1, t2)
    x, y, z = vector
    return np.array(
        [
            x * p.coherence_factor,
            y * p.coherence_factor,
            1 + (z - 1) * p.population_factor,
        ],
        dtype=np.float64,
    )
