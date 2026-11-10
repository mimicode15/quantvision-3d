import os
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from engine import service
from schemas import (
    NoiseEvolveIn,
    NoiseEvolveOut,
    NoiseParametersIn,
    NoiseParametersOut,
    SequenceIn,
    SequenceOut,
    StateIn,
    StateOut,
)

app = FastAPI(
    title="QuantVision API",
    version="0.2.0",
    description="Single-qubit states, gates and T1/T2 noise, computed with NumPy.",
)

_origins = os.environ.get("QV_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/state", response_model=StateOut, summary="Describe a pure state")
def post_state(body: StateIn) -> dict[str, Any]:
    """Amplitudes, measurement probabilities, Bloch vector, density matrix and purity."""
    return service.state_summary(body.theta, body.phi)


@app.post("/gates/apply", response_model=SequenceOut, summary="Apply a sequence of gates")
def post_gates_apply(body: SequenceIn) -> dict[str, Any]:
    """Run gates in order. `trace` lists the Bloch vector before and after every step."""
    steps = [(g.name, g.angle) for g in body.gates]
    return service.run_sequence(body.theta, body.phi, steps)


@app.post("/noise/parameters", response_model=NoiseParametersOut, summary="T1/T2 decay parameters")
def post_noise_parameters(body: NoiseParametersIn) -> dict[str, Any]:
    """Amplitude-damping gamma, phase-damping lambda and the surviving population/coherence."""
    return service.noise_parameters(body.t, body.t1, body.t2)


@app.post("/noise/evolve", response_model=NoiseEvolveOut, summary="Let a state decohere")
def post_noise_evolve(body: NoiseEvolveIn) -> dict[str, Any]:
    """The mixed state after time t: Bloch vector (it shrinks), density matrix and purity."""
    return service.noise_evolve(body.theta, body.phi, body.t, body.t1, body.t2)
