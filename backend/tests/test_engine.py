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
