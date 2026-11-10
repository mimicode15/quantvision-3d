"""Ground truth: our NumPy engine must agree with Qiskit and Qiskit Aer."""

import numpy as np
import pytest
from qiskit import QuantumCircuit, transpile
from qiskit.circuit.library import (
    HGate,
    RXGate,
    RYGate,
    RZGate,
    SGate,
    TGate,
    XGate,
    YGate,
    ZGate,
)
from qiskit.quantum_info import DensityMatrix, Kraus, Operator, Pauli, Statevector
from qiskit_aer import AerSimulator

from engine.decoherence import (
    amplitude_damping_kraus,
    apply_channel,
    evolve_density,
    phase_damping_kraus,
)
from engine.gates import GATES, apply_gate, rx, ry, rz
from engine.service import gate_matrix
from engine.state import (
    bloch_vector,
    bloch_vector_from_state,
    density_from_bloch,
    density_matrix,
    fidelity,
    measurement_probabilities,
    normalize,
    purity,
    state_from_angles,
)

FIXED = {"X": XGate, "Y": YGate, "Z": ZGate, "H": HGate, "S": SGate, "T": TGate}
ROTATIONS = {"RX": (RXGate, rx), "RY": (RYGate, ry), "RZ": (RZGate, rz)}
ANGLES = [-3.0, -0.5, 0.0, 0.7, np.pi, 5.1]


def random_states(count: int, seed: int):
    rng = np.random.default_rng(seed)
    return [normalize(rng.normal(size=2) + 1j * rng.normal(size=2)) for _ in range(count)]


# ------------------------------------------------------------ gate matrices
@pytest.mark.parametrize("name", list(FIXED))
def test_fixed_gate_matrices_match_qiskit(name):
    assert np.allclose(GATES[name], FIXED[name]().to_matrix())


@pytest.mark.parametrize("name", list(ROTATIONS))
@pytest.mark.parametrize("angle", ANGLES)
def test_rotation_matrices_match_qiskit(name, angle):
    qiskit_gate, ours = ROTATIONS[name]
    assert np.allclose(ours(angle), qiskit_gate(angle).to_matrix())


@pytest.mark.parametrize("name", list(FIXED))
def test_gate_evolution_matches_qiskit_statevector(name):
    for state in random_states(10, seed=11):
        reference = Statevector(state).evolve(Operator(FIXED[name]())).data
        assert np.allclose(apply_gate(GATES[name], state), reference)


# ---------------------------------------------------- states and measurement
def test_bloch_vector_matches_qiskit_pauli_expectations():
    for state in random_states(25, seed=12):
        reference = [Statevector(state).expectation_value(Pauli(p)).real for p in "XYZ"]
        assert np.allclose(bloch_vector_from_state(state), reference, atol=1e-12)


def test_probabilities_match_qiskit():
    for state in random_states(25, seed=13):
        reference = Statevector(state).probabilities()
        assert np.allclose(measurement_probabilities(state), reference, atol=1e-12)


def test_density_matrix_and_purity_match_qiskit():
    for state in random_states(10, seed=14):
        reference = DensityMatrix(Statevector(state))
        assert np.allclose(density_matrix(state), reference.data)
        assert purity(density_matrix(state)) == pytest.approx(reference.purity())
    mixed = density_from_bloch(np.array([0.1, 0.2, 0.3]))
    assert purity(mixed) == pytest.approx(DensityMatrix(mixed).purity())
    assert np.allclose(bloch_vector(mixed), [0.1, 0.2, 0.3])


# -------------------------------------------------------------------- noise
@pytest.mark.parametrize(
    "gamma, lam", [(0.0, 0.0), (0.3, 0.0), (0.0, 0.6), (0.4, 0.25), (1.0, 1.0)]
)
def test_kraus_channels_match_qiskit(gamma, lam):
    for state in random_states(5, seed=15):
        rho = density_from_bloch(0.8 * bloch_vector_from_state(state))  # a mixed state
        ours = apply_channel(
            apply_channel(rho, amplitude_damping_kraus(gamma)), phase_damping_kraus(lam)
        )
        reference = (
            DensityMatrix(rho)
            .evolve(Kraus(amplitude_damping_kraus(gamma)))
            .evolve(Kraus(phase_damping_kraus(lam)))
            .data
        )
        assert np.allclose(ours, reference, atol=1e-12)


@pytest.mark.parametrize(
    "t1, t2, t",
    [(50.0, 30.0, 12.0), (50.0, 80.0, 12.0), (50.0, 100.0, 12.0), (20.0, 5.0, 40.0)],
)
def test_aer_thermal_relaxation_matches_our_t1_t2_model(t1, t2, t):
    """Aer's thermal_relaxation_error is the reference channel for given T1, T2, time."""
    from qiskit_aer.noise import thermal_relaxation_error

    channel = thermal_relaxation_error(t1, t2, t).to_quantumchannel()
    for state in random_states(8, seed=16):
        rho = density_matrix(state)
        reference = DensityMatrix(rho).evolve(channel).data
        assert np.allclose(evolve_density(rho, t, t1, t2), reference, atol=1e-9)


# ------------------------------------------------------------- Aer circuits
def add_step(circuit: QuantumCircuit, name: str, angle: float | None) -> None:
    if name in ROTATIONS:
        getattr(circuit, name.lower())(angle, 0)
    else:
        getattr(circuit, "id" if name == "I" else name.lower())(0)


def test_aer_statevector_matches_numpy_for_random_gate_sequences():
    rng = np.random.default_rng(17)
    names = ["I", "X", "Y", "Z", "H", "S", "T", "RX", "RY", "RZ"]
    simulator = AerSimulator(method="statevector")
    for _ in range(10):
        theta, phi = rng.uniform(0, np.pi), rng.uniform(0, 2 * np.pi)
        steps = []
        for _ in range(12):
            name = str(rng.choice(names))
            steps.append((name, float(rng.uniform(-np.pi, np.pi)) if name in ROTATIONS else None))

        circuit = QuantumCircuit(1)
        circuit.ry(theta, 0)  # ry then rz prepares our state up to a global phase
        circuit.rz(phi, 0)
        state = state_from_angles(theta, phi)
        for name, angle in steps:
            add_step(circuit, name, angle)
            state = apply_gate(gate_matrix(name, angle), state)
        circuit.save_statevector()

        result = simulator.run(transpile(circuit, simulator)).result()
        aer_state = Statevector(result.get_statevector()).data
        assert fidelity(state, aer_state) == pytest.approx(1.0, abs=1e-9)
        assert np.allclose(
            bloch_vector_from_state(state), bloch_vector_from_state(aer_state), atol=1e-9
        )


def test_aer_sampling_matches_the_born_rule():
    theta, shots = 1.1, 20000
    circuit = QuantumCircuit(1, 1)
    circuit.ry(theta, 0)
    circuit.rz(0.4, 0)  # a phase does not change Z-basis statistics
    circuit.measure(0, 0)
    simulator = AerSimulator()
    counts = simulator.run(transpile(circuit, simulator), shots=shots, seed_simulator=11)
    p0_expected = measurement_probabilities(state_from_angles(theta, 0.4))[0]
    assert counts.result().get_counts().get("0", 0) / shots == pytest.approx(p0_expected, abs=0.015)
