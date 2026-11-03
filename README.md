# QuantVision (qv3d)

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
