"""Write cross-language test cases that the TypeScript tests must reproduce.

Run from backend/:  python -m scripts.export_fixtures
"""

import json
from pathlib import Path

import numpy as np

from engine.decoherence import decay_parameters, evolve_density
from engine.gates import GATES, apply_gate, rx, ry, rz
from engine.state import (
    bloch_vector,
    bloch_vector_from_state,
    density_matrix,
    purity,
    state_from_angles,
)

FIXTURES = Path(__file__).resolve().parents[2] / "shared" / "fixtures"
OUT = FIXTURES / "gate_cases.json"
NOISE_OUT = FIXTURES / "noise_cases.json"
ROTATIONS = {"rx": rx, "ry": ry, "rz": rz}


def noise_cases() -> list[dict]:
    """Noisy states worked out with Kraus operators, to check the closed form in the browser."""
    rng = np.random.default_rng(7)
    settings = [
        (0.0, 100.0, 80.0),  # no time has passed
        (30.0, 100.0, 80.0),
        (100.0, 100.0, 200.0),  # T2 = 2*T1: only relaxation
        (100.0, 100.0, 50.0),
        (250.0, 40.0, 25.0),
        (5.0, 300.0, 600.0),
        (2000.0, 20.0, 15.0),  # a very long time
    ]
    cases = []
    for t, t1, t2 in settings:
        for _ in range(4):
            theta = float(rng.uniform(0, np.pi))
            phi = float(rng.uniform(0, 2 * np.pi))
            rho = evolve_density(density_matrix(state_from_angles(theta, phi)), t, t1, t2)
            params = decay_parameters(t, t1, t2)
            cases.append(
                {
                    "theta": theta,
                    "phi": phi,
                    "t": t,
                    "t1": t1,
                    "t2": t2,
                    "bloch": bloch_vector(rho).tolist(),
                    "purity": purity(rho),
                    "population": params.population_factor,
                    "coherence": params.coherence_factor,
                }
            )
    return cases


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

    noisy = noise_cases()
    NOISE_OUT.write_text(json.dumps(noisy, indent=2) + "\n")
    print(f"wrote {len(noisy)} cases to {NOISE_OUT}")


if __name__ == "__main__":
    main()
