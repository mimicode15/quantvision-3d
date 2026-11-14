# Making the app explain itself

Goal: someone who has never heard of a Bloch sphere understands the screen within two minutes, and an expert can skip all of it.

## Principles
1. **Explain on the thing itself.** Labels and callouts on the sphere beat a separate page.
2. **Progressive disclosure.** Default view shows the sphere, probabilities and controls. A "Show the math" toggle adds the ket, density matrix and purity.
3. **One idea per step.** The tour never shows two new concepts at once.
4. **Never block.** Every explanation can be skipped, reopened with a "?" button, and is keyboard and screen reader friendly.
5. **Words match the screen.** Use the same names as the labels (north pole, |0>, purity).

## Build in this order
| Priority | Feature | Why | Day |
| --- | --- | --- | --- |
| 1 | **Legend and plain labels.** Add "most likely 0" near the north pole and "most likely 1" near the south pole. A small "Equator: 50/50" tag. Rename the HUD's rho to "Density matrix (state table)". | Cheapest fix for the biggest confusion | 8 |
| 2 | **"?" popovers** next to the sphere, the arrow, each HUD row, each slider and the camera card. 2 to 3 sentences each, with a "Learn more" link into the drawer. | Answers the question at the moment it is asked | 8 |
| 3 | **First-run tour, 5 steps.** Sphere, arrow, controls (gates), measure, camera. Spotlight the element, Next/Back/Skip, remembered in localStorage, replay from the footer. | Orients new visitors | 8 |
| 4 | **Docs drawer with four tabs:** Sphere, Gestures, The math, Hardware reality. Content comes from `WHAT_YOU_ARE_SEEING.md`. | The depth layer | 8 |
| 5 | **Live captions** in the note line, one sentence per action: "H: half turn about the axis between x and z. |0> became |+>." | Teaches while they play | 8 |
| 6 | **Ghost arrow.** After a gate or measurement, draw the previous arrow faintly for a moment, with a curved arc showing the rotation. | Makes "gates are rotations" visible | 8 or after |
| 7 | **Angle overlays** (toggle): the theta arc from the north pole, the phi arc on the equator, drawn on the sphere. | Connects numbers to geometry | after MVP |
| 8 | **Linked highlighting.** Hover P(0) to highlight the arrow's height; hover rho's off-diagonal to highlight the equator projection; hover purity to highlight the arrow length. | The best way to connect the math to the picture | after MVP |
| 9 | **Hardware panel narration.** Show a faint pure arrow (where it would be without noise) next to the real, shorter one, plus a sentence: "Purity 0.82: the state is partly mixed." | Makes decoherence concrete | 7 |
| 10 | **Challenges:** "Make |+>", "Make |-i> using only H and S", "Find a state with P(0) = 0.25". Check the answer and show a hint. | Turns watching into learning | after MVP |
| 11 | **Glossary** with each term in KaTeX, linked from the popovers. | Reference | 8 |
| 12 | **Camera coach.** A short looping image or animation of the pinch and palm gestures in the camera card when it is first enabled. | Gestures are the hardest part to discover | 8 |

## Copy rules
- Start from what the person sees ("the arrow points at the equator"), then say what it means.
- Define every term once, in plain words, at first use.
- Say "probability", not "amplitude", until the math toggle is on.
- No claim about real hardware without a cited source.
- Keep each popover under 40 words.

## Measure it
Run the first-time viewer test from the test plan (E2): five newcomers, two minutes, then ask what the arrow, the poles and "inside the sphere" mean. Fix whatever they get wrong before adding features.
