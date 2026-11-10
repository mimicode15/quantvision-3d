"""Pydantic models: what the API accepts and what it returns."""

import math
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from engine.decoherence import t2_within_limit
from engine.service import ROTATION_GATES

MAX_GATES = 200
GateName = Literal["I", "X", "Y", "Z", "H", "S", "T", "RX", "RY", "RZ"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------- requests
class StateIn(_Strict):
    theta: float = Field(
        ge=0, le=math.pi, allow_inf_nan=False, description="Polar angle: 0 is |0>, pi is |1>."
    )
    phi: float = Field(
        ge=-100, le=100, allow_inf_nan=False, description="Azimuth in radians (wrapped to 0..2pi)."
    )


class GateStep(_Strict):
    name: GateName
    angle: float | None = Field(
        default=None, ge=-100, le=100, allow_inf_nan=False, description="Radians; RX/RY/RZ only."
    )

    @model_validator(mode="after")
    def _angle_matches_gate(self) -> Self:
        rotation = self.name in ROTATION_GATES
        if rotation and self.angle is None:
            raise ValueError(f"gate {self.name} requires an angle (radians)")
        if not rotation and self.angle is not None:
            raise ValueError(f"gate {self.name} does not take an angle")
        return self


class SequenceIn(StateIn):
    gates: list[GateStep] = Field(min_length=1, max_length=MAX_GATES)


class NoiseParametersIn(_Strict):
    t: float = Field(ge=0, allow_inf_nan=False, description="Elapsed time.")
    t1: float = Field(gt=0, allow_inf_nan=False, description="Relaxation time, same units as t.")
    t2: float = Field(gt=0, allow_inf_nan=False, description="Dephasing time, same units as t.")

    @model_validator(mode="after")
    def _t2_is_physical(self) -> Self:
        if not t2_within_limit(self.t1, self.t2):
            raise ValueError("T2 cannot exceed 2*T1 (physical limit)")
        return self


class NoiseEvolveIn(StateIn, NoiseParametersIn):
    pass


# --------------------------------------------------------------- responses
class Bloch(BaseModel):
    x: float
    y: float
    z: float


class ComplexNumber(BaseModel):
    re: float
    im: float


class Amplitudes(BaseModel):
    a: ComplexNumber  # amplitude of |0>
    b: ComplexNumber  # amplitude of |1>


class Probabilities(BaseModel):
    p0: float
    p1: float


class DensityMatrixOut(BaseModel):
    re: list[list[float]]
    im: list[list[float]]


class MixedStateOut(BaseModel):
    bloch: Bloch
    density_matrix: DensityMatrixOut
    probabilities: Probabilities
    purity: float
    bloch_length: float


class StateOut(MixedStateOut):
    theta: float
    phi: float
    amplitudes: Amplitudes


class SequenceOut(BaseModel):
    final: StateOut
    trace: list[Bloch]


class NoiseParametersOut(BaseModel):
    t: float
    t1: float
    t2: float
    t_phi: float | None
    population_factor: float
    coherence_factor: float
    amplitude_damping_gamma: float
    phase_damping_lambda: float


class NoiseEvolveOut(MixedStateOut):
    parameters: NoiseParametersOut
