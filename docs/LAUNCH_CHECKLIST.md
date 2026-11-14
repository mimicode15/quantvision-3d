# QuantVision: status and launch checklist

Updated after Day 6. Tick items off as they are verified, not as they are written.

## 1. What exists today

| Area | Built | Verified how |
| --- | --- | --- |
| Math engine (Python) | Gates, states, density matrices, Lindblad T1/T2 noise, Kraus operators | pytest, plus Qiskit and Qiskit Aer ground truth |
| API (FastAPI) | `/state`, `/gates/apply`, `/noise/parameters`, `/noise/evolve`, `/health` | pytest, CI on every push |
| Math engine (TypeScript) | Same gates/states, runs in the browser | vitest, shared fixtures with Python |
| 3D scene | Bloch sphere, labelled poles, violet needle, phase wedge, orbit controls | Looked at in the browser |
| Camera and tracking | Webcam, MediaPipe HandLandmarker, mirrored preview, skeleton overlay | Fake-camera browser tests; **real hand not yet confirmed** |
| Gestures | Pinch to steer, hand height to theta, wrist tilt to phi, open palm to measure | Unit tests with synthetic hands; **thresholds untuned on real hands** |
| HUD | Live Dirac ket, probabilities, density matrix, purity (KaTeX, Syne Mono numbers) | Unit tests, real KaTeX render of 2,600+ states, browser checks |
| Fallback controls | theta/phi sliders, X Y Z H S T, Reset, Measure, keyboard + screen reader labels | Browser tests |

## 2. Still to build (roadmap)

- [ ] **Day 7: Hardware Reality Check.** T1/T2 sliders, evolve the density matrix, shrink the needle as purity drops, purity readout. Decide whether the browser computes the closed form itself (works offline) and the API is only used for cross-checks.
- [ ] **Day 8: Landing page and docs drawer.** Michroma headers, what a qubit is, why noise matters, gesture guide, open-source links.
- [ ] **Day 9: Performance and error handling.** Hold 60 fps with tracking on; camera-denied, no-camera, no-WebGL and model-missing paths all leave a usable app.
- [ ] **Day 10: Deploy and document.** Static frontend host, containerised backend, README with setup, math references and a demo GIF.
- [ ] Background particle dust (Three.js) from the visual spec. Not started.

## 3. Accuracy: what must be proven before launch

Physics (the part people will quote):
- [ ] Every gate matches Qiskit for the six basis/equator states and 100 random states (Python tests exist; extend the shared fixtures to density matrices and noise).
- [ ] The browser (TypeScript) and Python agree to 1e-9 on the same fixtures, including after gate chains.
- [ ] Conventions are explicit in the docs and match Qiskit: |0> at the north pole, |+> on +x, |+i> on +y, phi counter-clockwise from +x.
- [ ] Noise limits hold: T1 moves z toward +1 and never overshoots it, T2 only shrinks x and y, T2 <= 2 T1 is enforced, purity stays between 1/2 and 1, long time gives |0><0| for T1. Purity never increases with T2 alone, but under T1 it can dip and then recover for states that start in the lower half.
- [ ] The needle length is sqrt(2 purity - 1) in the scene, checked against the HUD's purity.
- [ ] Measurement statistics: 10,000 measurements of a state with P(0) = 0.75 land within a few percent.

Gestures (the part users will feel):
- [ ] Tune with at least 5 different people: left and right hands, small and large hands, glasses, bright window behind, dim room, hand 30 to 80 cm from the camera.
- [ ] Record the false-trigger rate of palm-to-measure over 10 idle minutes. Target: zero.
- [ ] Sliders and buttons can do everything the gestures can (they can today).

Teaching content:
- [ ] A physics instructor reads every sentence on the landing page and in the drawer.
- [ ] The noise model is labelled "illustrative": it is a textbook T1/T2 model, not a specific device's calibration.
- [ ] Say plainly what the Bloch sphere cannot show: more than one qubit, entanglement.

## 4. Testing matrix

Automated (add to CI):
- [ ] Frontend workflow: typecheck, lint, vitest, build (only the backend runs in CI today).
- [ ] Browser smoke test (Playwright with a fake camera): load, enable camera, pinch, measure, camera denied.
- [ ] Bundle-size budget: first load without MediaPipe and KaTeX stays small (both already load on demand).

Manual, before every release:
- [ ] Browsers: Chrome, Safari, Firefox on desktop; Safari on iPhone; Chrome on Android.
- [ ] Camera: allow, deny, no device, unplug while running, tab hidden and shown again.
- [ ] No WebGL: the message appears and the controls still work.
- [ ] Offline after first load, and with the backend down.
- [ ] Keyboard only: reach and use every control. Screen reader: sliders announce values, no flood during gestures.
- [ ] Reduced motion setting respected.
- [ ] Contrast: check teal text on cream (small teal text likely fails WCAG AA; use the deep espresso for text and teal for lines).
- [ ] Phone layout 360 to 430 px wide, tablet, 1280 and 1920 desktop, 125% browser zoom.
- [ ] Performance: frame rate with the camera on, on the slowest laptop you can find.

## 5. Trust and launch readiness

- [ ] Privacy statement in the page: video is processed in your browser and never uploaded. Confirm in the Network tab that no frames leave.
- [ ] Hosting uses https (browsers block the camera otherwise); CORS allows only the real frontend origin.
- [ ] `npm run setup-vision` runs in the deploy build (it runs before `npm run build`).
- [ ] LICENSE has your real name. README: install, run, test, deploy, math references, GIF.
- [ ] Error reporting that respects privacy (no video, no personal data) or none at all.
- [ ] A "report a bug" link and a short known-issues list.

## 6. After the MVP (iterate)

- Two-qubit view or a gate sequencer for circuits.
- Guided lessons with checkpoints ("make |+>", "make |-i>") and instant feedback.
- Compare to a real device's T1/T2 numbers, with sources.
- Share a state as a link.
- Touch gestures for phones without a camera.
