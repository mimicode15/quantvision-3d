# What you are looking at

QuantVision draws the state of **one qubit** as an arrow inside a sphere. This page is the plain-language source for the landing page, the docs drawer and the first-run tour. Keep wording at a first-year level; put the formulas behind a "show the math" toggle.

## In one sentence
The sphere is a map of every state a single qubit can be in, and the arrow shows which one it is in right now.

## The sphere (the Bloch sphere)
- Every point on the **surface** is one pure quantum state. Pure means we know the qubit's state exactly.
- It is a map, not a picture of real space. The qubit is not literally pointing somewhere in the room.
- **North pole, |0>.** If you measure now, you will always get 0.
- **South pole, |1>.** You will always get 1.
- **Equator.** A fifty-fifty chance of 0 or 1. The four labelled points are |+>, |->, |+i> and |-i>.
- **Height = probability.** The higher the arrow, the more likely a measurement gives 0: P(0) = (1 + z) / 2.
- **Angle around the sphere = phase (phi).** Phase does not change the chance of 0 or 1 right now, but it changes what later gates do. It is the part with no everyday analogy.

## The arrow
- It starts at the centre and points at the state.
- **theta** is the angle down from the north pole. **phi** is the angle around the vertical axis.
- Written as numbers: state = cos(theta/2)|0> + e^(i phi) sin(theta/2)|1>. The HUD shows this with your current values.
- The dashed line and dot on the equator plane show where the arrow points from above, so you can read phi.

## Gates turn the sphere
Every gate is a rotation of the whole sphere:
| Gate | What it does to the arrow |
| --- | --- |
| X | Half turn about the x axis. Swaps |0> and |1> (north pole to south pole). |
| Y | Half turn about the y axis. |
| Z | Half turn about the z axis. Leaves |0> and |1> alone, swaps |+> and |->. |
| H | Half turn about the axis between x and z. Turns |0> into |+>. |
| S | Quarter turn about z. Turns |+> into |+i>. |
| T | Eighth turn about z. |

## Measuring is not a rotation
- Measure asks the qubit "0 or 1?". The answer is random, with P(0) = cos^2(theta/2).
- Afterward the arrow **jumps** to the north pole (if 0) or the south pole (if 1). The old phase is gone.
- Measuring again gives the same answer.

## The HUD (the math panel)
- **Ket line.** The state as an equation. Named states (|+>, |-i> and so on) are labelled.
- **P(0), P(1).** The chance of each result. They always add to 1.
- **Density matrix (rho).** A 2 x 2 table that describes the state. Top-left is P(0), bottom-right is P(1). The off-diagonal numbers measure **coherence**, how much of a superposition is left. Bigger off-diagonal numbers mean a more "quantum" state. For a pure state rho = |psi><psi|, and rho = (I + xX + yY + zZ) / 2, so the table and the sphere carry the same information.
- **Purity, Tr(rho^2).** 1 means pure. 1/2 means completely mixed. Below 1 the arrow is inside the sphere.

## Hand controls
- **Pinch** thumb and first finger to grab. Move your hand **up or down** to change theta. **Tilt your wrist** left or right to change phi. Let go to keep the state.
- Hold an **open palm** still for about a second to measure.
- Everything also works with the sliders and buttons.
- The camera video stays on your computer. Nothing is uploaded.

## Hardware Reality Check (Day 7)
Real qubits are not perfectly isolated. Two kinds of noise:
- **T1, energy relaxation.** The qubit leaks energy to its surroundings and slides toward |0>. On the sphere the arrow sinks toward the north pole and shrinks on the way.
- **T2, dephasing.** The qubit loses its phase relationship with |0> and |1> without changing their probabilities. The arrow's sideways part (x and y) shrinks, so it leans in toward the vertical axis.
- Physics limits them: T2 can never be more than twice T1.
- **Inside the sphere = mixed state.** We no longer know the exact state, only probabilities. The arrow gets shorter; its length is sqrt(2 x purity - 1). At the very centre the qubit is a fair coin flip with no phase left.
- A state in the lower half can look *more* mixed for a while and then become pure again as T1 pulls it into |0>. That is correct, not a bug.
- Longer circuits take longer, so noise builds up. This is why today's hardware cannot run very long programs.

## What this tool does not show
- Only **one** qubit. Two or more qubits can be **entangled**, and that cannot be drawn on a single Bloch sphere.
- Global phase, which cannot be measured and is left out on purpose.
- The noise is a standard textbook model with adjustable numbers. It is not the calibration of any specific machine.
