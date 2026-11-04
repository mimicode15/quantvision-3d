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
