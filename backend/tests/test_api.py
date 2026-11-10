"""End-to-end HTTP tests using FastAPI's TestClient."""

import math

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def xyz(b):
    return [b["x"], b["y"], b["z"]]


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_state_for_the_plus_state():
    r = client.post("/state", json={"theta": math.pi / 2, "phi": 0})
    assert r.status_code == 200
    body = r.json()
    assert body["probabilities"]["p0"] == pytest.approx(0.5)
    assert xyz(body["bloch"]) == pytest.approx([1, 0, 0], abs=1e-9)
    assert body["purity"] == pytest.approx(1.0)


@pytest.mark.parametrize(
    "payload",
    [
        {"theta": 4, "phi": 0},
        {"theta": 1},
        {"theta": "abc", "phi": 0},
        {"theta": 1, "phi": 0, "surprise": True},
    ],
)
def test_state_rejects_bad_input(payload):
    assert client.post("/state", json=payload).status_code == 422


def test_gate_sequence_h_then_s():
    r = client.post(
        "/gates/apply",
        json={"theta": 0, "phi": 0, "gates": [{"name": "H"}, {"name": "S"}]},
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["trace"]) == 3
    assert xyz(body["final"]["bloch"]) == pytest.approx([0, 1, 0], abs=1e-9)


def test_rotation_gate_needs_an_angle():
    payload = {"theta": 0, "phi": 0, "gates": [{"name": "RX"}]}
    assert client.post("/gates/apply", json=payload).status_code == 422
    payload["gates"] = [{"name": "RX", "angle": math.pi}]
    r = client.post("/gates/apply", json=payload)
    assert r.status_code == 200
    assert xyz(r.json()["final"]["bloch"]) == pytest.approx([0, 0, -1], abs=1e-9)


def test_noise_parameters():
    r = client.post("/noise/parameters", json={"t": 10, "t1": 10, "t2": 20})
    assert r.status_code == 200
    body = r.json()
    assert body["population_factor"] == pytest.approx(math.exp(-1))
    assert body["coherence_factor"] == pytest.approx(math.exp(-0.5))
    assert body["t_phi"] is None


def test_noise_rejects_unphysical_t2():
    r = client.post("/noise/parameters", json={"t": 1, "t1": 10, "t2": 25})
    assert r.status_code == 422


def test_noise_evolve_excited_state_becomes_maximally_mixed():
    r = client.post(
        "/noise/evolve",
        json={"theta": math.pi, "phi": 0, "t": 10 * math.log(2), "t1": 10, "t2": 10},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["purity"] == pytest.approx(0.5)
    assert body["bloch_length"] == pytest.approx(0, abs=1e-9)
    assert body["parameters"]["amplitude_damping_gamma"] == pytest.approx(0.5)


def test_cors_allows_the_vite_dev_server_only():
    ok = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    other = client.get("/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in other.headers
