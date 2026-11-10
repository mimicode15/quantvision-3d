"""Turns engine objects into plain dicts for the HTTP layer. No FastAPI in here."""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any

import numpy as np

from .decoherence import decay_parameters, evolve_density
from .gates import GATES, Matrix, apply_gate, rx, ry, rz
from .state import (
    State,
    angles_from_state,
    bloch_vector,
    density_matrix,
    normalize,
    purity,
    state_from_angles,
)

FIXED_GATES = tuple(GATES)  # I, X, Y, Z, H, S, T
ROTATION_GATES = ("RX", "RY", "RZ")
_ROTATIONS = {"RX": rx, "RY": ry, "RZ": rz}
_TAU = 2 * math.pi


def gate_matrix(name: str, angle: float | None = None) -> Matrix:
    if name in GATES:
        return GATES[name]
    if name in _ROTATIONS:
        if angle is None:
            raise ValueError(f"gate {name} requires an angle in radians")
        return _ROTATIONS[name](angle)
    raise ValueError(f"unknown gate {name!r}")


def _bloch_dict(vector: Any) -> dict[str, float]:
    return {"x": float(vector[0]), "y": float(vector[1]), "z": float(vector[2])}


def _describe_density(rho: Matrix) -> dict[str, Any]:
    bloch = bloch_vector(rho)
    p0 = min(max(float(rho[0, 0].real), 0.0), 1.0)
    return {
        "bloch": _bloch_dict(bloch),
        "density_matrix": {"re": rho.real.tolist(), "im": rho.imag.tolist()},
        "probabilities": {"p0": p0, "p1": 1.0 - p0},
        "purity": purity(rho),
        "bloch_length": float(np.linalg.norm(bloch)),
    }


def _describe_state(state: State) -> dict[str, Any]:
    s = normalize(state)
    theta, phi = angles_from_state(s)
    out = _describe_density(density_matrix(s))
    out["theta"] = theta
    out["phi"] = phi
    out["amplitudes"] = {
        "a": {"re": float(s[0].real), "im": float(s[0].imag)},
        "b": {"re": float(s[1].real), "im": float(s[1].imag)},
    }
    return out


def state_summary(theta: float, phi: float) -> dict[str, Any]:
    return _describe_state(state_from_angles(theta, phi % _TAU))


def run_sequence(
    theta: float, phi: float, steps: Sequence[tuple[str, float | None]]
) -> dict[str, Any]:
    """Apply gates in order. `trace` holds the Bloch vector before and after every step."""
    state = normalize(state_from_angles(theta, phi % _TAU))
    trace = [_bloch_dict(bloch_vector(density_matrix(state)))]
    for name, angle in steps:
        state = normalize(apply_gate(gate_matrix(name, angle), state))
        trace.append(_bloch_dict(bloch_vector(density_matrix(state))))
    return {"final": _describe_state(state), "trace": trace}


def noise_parameters(t: float, t1: float, t2: float) -> dict[str, float | None]:
    return decay_parameters(t, t1, t2).as_dict()


def noise_evolve(theta: float, phi: float, t: float, t1: float, t2: float) -> dict[str, Any]:
    params = decay_parameters(t, t1, t2)
    rho = evolve_density(density_matrix(state_from_angles(theta, phi % _TAU)), t, t1, t2)
    out = _describe_density(rho)
    out["parameters"] = params.as_dict()
    return out
