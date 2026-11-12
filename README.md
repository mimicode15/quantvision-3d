# QuantVision (qv3d)

[![Backend tests](https://github.com/mimicode15/quantvision-3d/actions/workflows/test-backend.yml/badge.svg)](https://github.com/mimicode15/quantvision-3d/actions/workflows/test-backend.yml)

Gesture-driven 3D Bloch sphere visualizer with a decoherence "Hardware Reality Check".
Status: day 0, scaffolding only.

## Quickstart
```bash
# frontend
cd frontend && npm install && npm run dev
# backend
cd backend && python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn main:app --reload
```

## API (backend)

Run `uvicorn main:app --reload` in `backend/`, then open http://127.0.0.1:8000/docs.

| Endpoint | Purpose |
|---|---|
| `POST /state` | Amplitudes, probabilities, Bloch vector, density matrix and purity for (theta, phi) |
| `POST /gates/apply` | Apply a sequence of gates; returns the final state and a Bloch-vector trace |
| `POST /noise/parameters` | T1/T2 decay parameters (gamma, lambda, surviving population and coherence) |
| `POST /noise/evolve` | The mixed state after a time t of T1/T2 noise |

## Hand tracking files
The MediaPipe wasm runtime and hand model are not committed. After `npm install`, run
`cd frontend && npm run setup-vision` once (it also runs before `npm run build`).
