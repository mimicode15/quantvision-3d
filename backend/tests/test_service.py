"""The service layer and request/response schemas (no web server needed)."""

import math

import numpy as np
import pytest
from pydantic import ValidationError

from engine import service
from engine.gates import apply_gate
from engine.state import bloch_vector_from_state, state_from_angles
from schemas import (
    GateStep,
    NoiseEvolveIn,
    NoiseEvolveOut,
    NoiseParametersIn,
    NoiseParametersOut,
    SequenceIn,
    SequenceOut,
    StateIn,
    StateOut,
)


def xyz(b):
    return [b["x"], b["y"], b["z"]]


def test_plus_state_summary():
    out = service.state_summary(math.pi / 2, 0)
    assert out["probabilities"]["p0"] == pytest.approx(0.5)
    assert xyz(out["bloch"]) == pytest.approx([1, 0, 0], abs=1e-12)
    assert out["purity"] == pytest.approx(1.0)
    assert out["bloch_length"] == pytest.approx(1.0)
    assert out["theta"] == pytest.approx(math.pi / 2)


def test_summary_fits_the_response_schema():
    StateOut.model_validate(service.state_summary(1.0, 2.0))


def test_phi_is_wrapped_into_one_turn():
    a = service.state_summary(1.0, 0.3)
    b = service.state_summary(1.0, 0.3 + 2 * math.pi)
    assert a["phi"] == pytest.approx(b["phi"])
    assert xyz(a["bloch"]) == pytest.approx(xyz(b["bloch"]), abs=1e-12)


def test_h_then_s_walks_z_to_x_to_y():
    out = service.run_sequence(0, 0, [("H", None), ("S", None)])
    assert len(out["trace"]) == 3
    assert xyz(out["trace"][0]) == pytest.approx([0, 0, 1], abs=1e-12)
    assert xyz(out["trace"][1]) == pytest.approx([1, 0, 0], abs=1e-12)
    assert xyz(out["final"]["bloch"]) == pytest.approx([0, 1, 0], abs=1e-12)
    SequenceOut.model_validate(out)


def test_sequence_equals_the_matrix_product():
    rng = np.random.default_rng(8)
    names = ["X", "Y", "Z", "H", "S", "T", "RX", "RY", "RZ"]
    steps = []
    for _ in range(40):
        name = str(rng.choice(names))
        steps.append((name, float(rng.uniform(-3, 3)) if name.startswith("R") else None))
    theta, phi = 1.2, 0.7
    state = state_from_angles(theta, phi)
    for name, angle in steps:
        state = apply_gate(service.gate_matrix(name, angle), state)
    out = service.run_sequence(theta, phi, steps)
    assert xyz(out["final"]["bloch"]) == pytest.approx(
        list(bloch_vector_from_state(state)), abs=1e-9
    )


def test_service_rejects_bad_gates():
    with pytest.raises(ValueError):
        service.gate_matrix("RX")
    with pytest.raises(ValueError):
        service.gate_matrix("CNOT")


def test_noise_outputs_fit_their_schemas():
    NoiseParametersOut.model_validate(service.noise_parameters(1, 10, 5))
    NoiseEvolveOut.model_validate(service.noise_evolve(1, 2, 3, 10, 5))


def test_noise_evolve_shrinks_an_equator_state():
    out = service.noise_evolve(math.pi / 2, 0, 5, 1e9, 5)
    assert out["bloch_length"] == pytest.approx(math.exp(-1), abs=1e-6)
    assert out["purity"] < 1


def test_excited_state_halfway_is_maximally_mixed():
    out = service.noise_evolve(math.pi, 0, 10 * math.log(2), 10, 10)
    assert out["bloch_length"] == pytest.approx(0, abs=1e-12)
    assert out["purity"] == pytest.approx(0.5)


# ------------------------------------------------------------------ schemas
def test_state_schema_bounds():
    StateIn(theta=0, phi=0)
    StateIn(theta=math.pi, phi=6.0)
    for bad in [{"theta": 4, "phi": 0}, {"theta": -0.1, "phi": 0}, {"theta": 1, "phi": 500}]:
        with pytest.raises(ValidationError):
            StateIn(**bad)
    with pytest.raises(ValidationError):
        StateIn(theta=1, phi=0, extra=1)  # unknown fields are rejected


def test_gate_step_angle_rules():
    GateStep(name="H")
    GateStep(name="RX", angle=1.0)
    with pytest.raises(ValidationError):
        GateStep(name="RX")
    with pytest.raises(ValidationError):
        GateStep(name="H", angle=1.0)
    with pytest.raises(ValidationError):
        GateStep(name="CNOT")


def test_sequence_length_limits():
    base = {"theta": 0, "phi": 0}
    with pytest.raises(ValidationError):
        SequenceIn(**base, gates=[])
    with pytest.raises(ValidationError):
        SequenceIn(**base, gates=[{"name": "X"}] * 201)
    assert len(SequenceIn(**base, gates=[{"name": "X"}] * 200).gates) == 200


def test_noise_schema_enforces_the_t2_limit():
    NoiseParametersIn(t=1, t1=10, t2=20)
    with pytest.raises(ValidationError):
        NoiseParametersIn(t=1, t1=10, t2=20.5)
    with pytest.raises(ValidationError):
        NoiseEvolveIn(theta=1, phi=0, t=1, t1=10, t2=25)
    with pytest.raises(ValidationError):
        NoiseParametersIn(t=-1, t1=10, t2=5)
