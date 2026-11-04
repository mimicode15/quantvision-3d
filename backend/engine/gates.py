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
