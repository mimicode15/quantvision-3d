"""T1/T2 noise: parameters, Kraus channels and the closed-form Bloch equations."""

import math

import numpy as np
import pytest

from engine.decoherence import (
    amplitude_damping_kraus,
    decay_parameters,
    evolve_bloch,
    evolve_density,
    phase_damping_kraus,
    t2_within_limit,
)
from engine.gates import IDENTITY
from engine.state import bloch_vector, density_from_bloch, density_matrix, purity, state_from_angles


def random_bloch(rng: np.random.Generator, pure: bool = False):
    direction = rng.normal(size=3)
    direction /= np.linalg.norm(direction)
    return direction if pure else direction * rng.uniform(0, 1)


def test_parameters_at_time_zero():
    p = decay_parameters(0, 10, 5)
    assert p.amplitude_damping_gamma == 0
    assert p.phase_damping_lambda == 0
    assert p.population_factor == 1
    assert p.coherence_factor == 1


def test_t2_equal_to_twice_t1_means_pure_amplitude_damping():
    p = decay_parameters(5, 10, 20)
    assert p.t_phi is None
    assert p.phase_damping_lambda == 0
    assert p.amplitude_damping_gamma == pytest.approx(1 - math.exp(-0.5))


def test_pure_dephasing_time():
    # 1/T_phi = 1/T2 - 1/(2 T1) = 1/4 - 1/8 = 1/8
    assert decay_parameters(1, 4, 4).t_phi == pytest.approx(8.0)


@pytest.mark.parametrize(
    "t, t1, t2",
    [(1, 1, 2.5), (1, 0, 1), (1, 1, 0), (-1, 1, 1), (float("nan"), 1, 1), (1, float("inf"), 1)],
)
def test_unphysical_inputs_are_rejected(t, t1, t2):
    with pytest.raises(ValueError):
        decay_parameters(t, t1, t2)


def test_t2_limit_helper():
    assert t2_within_limit(10, 20)
    assert t2_within_limit(10, 5)
    assert not t2_within_limit(10, 20.5)


@pytest.mark.parametrize("p", [0.0, 0.3, 1.0])
def test_kraus_operators_are_complete(p):
    for kraus in (amplitude_damping_kraus(p), phase_damping_kraus(p)):
        total = sum(k.conj().T @ k for k in kraus)
        assert np.allclose(total, IDENTITY)


def test_kraus_rejects_bad_probabilities():
    with pytest.raises(ValueError):
        amplitude_damping_kraus(1.1)
    with pytest.raises(ValueError):
        phase_damping_kraus(-0.1)


def test_channel_matches_the_closed_form_bloch_equations():
    rng = np.random.default_rng(42)
    for _ in range(100):
        vec = random_bloch(rng)
        t1 = rng.uniform(0.5, 50)
        t2 = rng.uniform(0.1, 2 * t1)
        t = rng.uniform(0, 3 * t1)
        via_channel = bloch_vector(evolve_density(density_from_bloch(vec), t, t1, t2))
        assert np.allclose(via_channel, evolve_bloch(vec, t, t1, t2), atol=1e-12)


def test_evolution_keeps_a_valid_density_matrix():
    rng = np.random.default_rng(1)
    for _ in range(50):
        rho = density_from_bloch(random_bloch(rng))
        t1 = rng.uniform(1, 20)
        out = evolve_density(rho, rng.uniform(0, 30), t1, rng.uniform(0.5, 2 * t1))
        assert np.trace(out) == pytest.approx(1.0)
        assert np.allclose(out, out.conj().T)
        assert np.linalg.eigvalsh(out).min() > -1e-12


def test_zero_time_changes_nothing():
    vec = np.array([0.3, -0.2, 0.5])
    assert np.allclose(evolve_bloch(vec, 0, 10, 10), vec)


def test_ground_state_is_a_fixed_point():
    rho = density_matrix(np.array([1, 0], dtype=complex))
    assert np.allclose(evolve_density(rho, 7.0, 10.0, 6.0), rho)


def test_long_times_relax_to_the_ground_state():
    vec = np.array([0.6, 0.0, -0.8])
    assert np.allclose(evolve_bloch(vec, 1e5, 10, 10), [0, 0, 1], atol=1e-9)


def test_excited_state_is_maximally_mixed_after_t1_ln2():
    # z(t) = 1 + (-1 - 1) e^{-t/T1} = 0 when t = T1 ln 2
    rho = density_matrix(np.array([0, 1], dtype=complex))
    out = evolve_density(rho, 10 * math.log(2), 10, 10)
    assert np.allclose(bloch_vector(out), [0, 0, 0], atol=1e-12)
    assert purity(out) == pytest.approx(0.5)


def test_pure_dephasing_shrinks_the_needle_exponentially():
    equator = density_matrix(state_from_angles(math.pi / 2, 0.7))
    lengths = []
    for t in np.linspace(0, 3, 7):
        r = bloch_vector(evolve_density(equator, float(t), 1e9, 1.0))
        lengths.append(float(np.linalg.norm(r)))
        assert lengths[-1] == pytest.approx(math.exp(-t), abs=1e-6)
    assert lengths == sorted(lengths, reverse=True)


def test_purity_and_needle_length_stay_linked():
    rng = np.random.default_rng(3)
    for _ in range(25):
        out = evolve_density(density_from_bloch(random_bloch(rng, pure=True)), 4.0, 9.0, 7.0)
        length = np.linalg.norm(bloch_vector(out))
        assert purity(out) == pytest.approx((1 + length**2) / 2)
