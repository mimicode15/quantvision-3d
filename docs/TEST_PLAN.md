# QuantVision test plan (run when all 10 days are done)

Each item has a pass rule. "Auto" runs in CI on every push; "Manual" is done by a person before a release and the result is written into the release notes.

## A. Physics correctness (auto, backend + frontend)
| # | Check | Pass rule |
| --- | --- | --- |
| A1 | Gates X, Y, Z, H, S, T on |0>, |1>, |+>, |->, |+i>, |-i> | Equal to Qiskit Statevector to 1e-12 |
| A2 | Same gates on 100 random states | Equal to Qiskit to 1e-10 |
| A3 | TypeScript vs Python on the shared fixtures, including gate chains of length 10 | Agree to 1e-9 |
| A4 | Density matrix: Hermitian, trace 1, purity 1 (pure), rho^2 = rho | Holds on a 13 x 12 angle sweep (exists) |
| A5 | Bloch vector from rho vs the vector drawn by the scene | Equal to 1e-12 (exists) |
| A6 | Measurement: 10,000 samples of P(0) = 0.75 | Frequency within 0.02 of 0.75; repeating a measurement never changes the result |
| A7 | T1 only: z moves toward +1 and never overshoots it; x, y shrink | Matches the closed form and Qiskit Aer thermal relaxation |
| A8 | T2 only: x, y shrink by exp(-t/T2); z unchanged | Same |
| A9 | T2 > 2 T1 | Rejected by API and by the slider limits |
| A10 | Purity during noise | Stays in [1/2, 1]. With T2 only it never increases. With T1 it can rise again: a state starting in the lower half dips toward the centre, then recovers as it relaxes into |0>. Assert exactly that, not "never increases" |
| A11 | Long time (t >> T1, T2) | Needle returns to +z (|0>) |
| A12 | Needle length in the scene | Equals sqrt(2 purity - 1) |
| A13 | Frontend noise (if computed in the browser) vs backend `/noise/evolve` | Agree to 1e-9 for 50 random (state, T1, T2, t) |

## B. Vision and gestures
Auto (synthetic hands, exists): pinch hysteresis, theta/phi mapping and gain, pole clamping, no jump on grab, dropout grace, palm hold, cooldown, lockout after release.
Manual, with real people and a real camera:
| # | Check | Pass rule |
| --- | --- | --- |
| B1 | Pinch to steer, 5 people | Everyone can grab within 3 attempts |
| B2 | Both hands | Works with left and right hands |
| B3 | Distance | Works from 30 to 80 cm |
| B4 | Lighting | Works in dim room, bright window behind, and lamp from the side |
| B5 | Accessories | Works with glasses, rings, long sleeves |
| B6 | Idle false positives | 10 minutes of normal sitting, typing, talking: zero accidental measures, zero accidental steering |
| B7 | Frame rate | At least 20 tracking frames per second on the slowest test laptop |
| B8 | Tilt and height feel | Each person can reach |+>, |-i> and |1> in under 20 seconds |
| B9 | Camera denied, no camera, unplugged mid-run, tab hidden and shown | Clear message, sliders still work, no crash, camera light turns off after Stop |
| B10 | Privacy | Network tab shows no video or landmark upload while the camera runs |

## C. 3D scene
| # | Check | Pass rule |
| --- | --- | --- |
| C1 | Orientation | |0> top, |+> +x, |+i> +y, matching the labels and Qiskit |
| C2 | Poles and phase | Needle at each pole and at the six named states points at the right label |
| C3 | Smoothness | 60 fps with the camera off; no visible jumps when the target changes |
| C4 | Orbit, zoom, resize, rotate phone | No clipped labels; no page scroll while dragging the canvas |
| C5 | No WebGL | Message appears; controls and HUD still work |
| C6 | Reduced motion | Needle snaps instead of gliding |
| C7 | Tab hidden for 10 minutes | No memory growth, no runaway animation |

## D. HUD, controls and noise panel
| # | Check | Pass rule |
| --- | --- | --- |
| D1 | Every control updates the sphere, HUD and sliders together | No control leaves another out of sync |
| D2 | KaTeX | Renders for every state; fallback text if the library fails to load |
| D3 | Number formats | No "-0.000"; phi in [0, 360); poles show |0> or |1> |
| D4 | Noise sliders | Moving T1/T2 changes purity, needle length and the matrix together |
| D5 | Backend down | Noise still works (browser calculation) or shows a clear message |
| D6 | Reset and Measure | Reset returns to |0> and clears noise; Measure result matches the HUD's P(0) over many runs |

## E. Content and teaching
| # | Check | Pass rule |
| --- | --- | --- |
| E1 | Physics review | An instructor reads every sentence and signs off |
| E2 | First-time viewer test | 5 people who have never seen a Bloch sphere: each can say what the arrow, the poles, and "inside the sphere" mean after 2 minutes |
| E3 | Terms | Every term (qubit, superposition, phase, purity, T1, T2) is defined at first use |
| E4 | Honest limits | Page says what is not shown: more than one qubit, entanglement, a specific real device |
| E5 | Numbers and claims | Every real-hardware number has a cited source |

## F. Accessibility
| # | Check | Pass rule |
| --- | --- | --- |
| F1 | Keyboard only | Every control reachable and usable; visible focus ring |
| F2 | Screen reader (VoiceOver) | Sliders announce degrees; no announcement flood during gestures; math has readable text |
| F3 | Contrast | Body text 4.5:1 or better; small teal text replaced or darkened |
| F4 | Zoom | Usable at 200% browser zoom and with large system text |
| F5 | Touch | Buttons at least 44 px tall on phones |

## G. Compatibility and performance
| # | Check | Pass rule |
| --- | --- | --- |
| G1 | Desktop browsers | Chrome, Safari, Firefox, Edge latest |
| G2 | Mobile | Safari iPhone, Chrome Android: camera works or degrades with a message |
| G3 | Sizes | 360, 390, 768, 1280, 1920 px wide; short height 680 px |
| G4 | First load | Before the camera is enabled, MediaPipe and KaTeX are not downloaded |
| G5 | Speed | First meaningful paint under 2 s on a normal connection; total JS under budget set on Day 9 |
| G6 | Profile | Chrome DevTools: no long tasks over 50 ms during gestures |

## H. Deployment and repository
| # | Check | Pass rule |
| --- | --- | --- |
| H1 | https only; camera prompt appears on the live URL | Yes |
| H2 | CORS | Only the real frontend origin can call the API |
| H3 | Fresh clone | README steps work on a clean machine, `npm run setup-vision` included |
| H4 | CI | Both workflows green on main; badges in README |
| H5 | Container | Backend image builds and `/health` responds |
| H6 | Licence and credits | LICENSE has the real name; MediaPipe, KaTeX, Three.js, fonts credited |

## Release gate
Ship the MVP when all of A, C1 to C5, D1 to D4, E1, E4, F1, G1 and H1 to H4 pass, B6 and B9 pass, and every failure elsewhere is written down in a known-issues list.
