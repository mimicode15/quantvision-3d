// Text for the docs drawer. Plain data so it can be tested without a browser.

export type Block =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "math"; tex: string; caption?: string };

export interface DocSection {
  id: string;
  title: string;
  blocks: Block[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "hands",
    title: "Hand controls",
    blocks: [
      {
        kind: "list",
        items: [
          "Press Start camera and hold one hand in view.",
          "Pinch your thumb and first finger together to grab the arrow.",
          "While pinching, move your hand up or down to change θ, the angle from the north pole.",
          "Tilt your wrist left or right to change φ, the angle around the sphere.",
          "Let go to keep the state where it is.",
          "Hold an open palm still for about a second to measure.",
        ],
      },
      {
        kind: "p",
        text: "No camera, or don't want to use it? The θ and φ sliders and the gate buttons do the same things. The video stays in your browser and is never uploaded.",
      },
    ],
  },
  {
    id: "sphere",
    title: "What you are looking at",
    blocks: [
      {
        kind: "p",
        text: "One qubit, drawn as an arrow inside a sphere. Every point on the surface is one possible pure state, so the sphere is a map of all of them. It is not a picture of real space.",
      },
      {
        kind: "list",
        items: [
          "North pole is |0⟩. Measuring there always gives 0.",
          "South pole is |1⟩. Measuring there always gives 1.",
          "On the equator, 0 and 1 are equally likely. The labelled points are |+⟩, |−⟩, |+i⟩ and |−i⟩.",
          "The higher the arrow, the more likely a 0. Height is the whole story for the odds.",
          "The angle around the sphere is the phase φ. It doesn't change the odds right now, but it changes what later gates do.",
          "The dashed line and dot on the equator plane show where the arrow points from above, so you can read φ.",
        ],
      },
      {
        kind: "p",
        text: "Gates turn the whole sphere. X, Y and Z are half turns about their axes. H turns |0⟩ into |+⟩. S is a quarter turn about z and T is an eighth turn. Measuring is different: it isn't a rotation, the arrow jumps to a pole.",
      },
    ],
  },
  {
    id: "math",
    title: "The math",
    blocks: [
      { kind: "p", text: "Every pure state can be written with two angles:" },
      {
        kind: "math",
        tex: "|\\psi\\rangle = \\cos\\tfrac{\\theta}{2}\\,|0\\rangle + e^{i\\varphi}\\sin\\tfrac{\\theta}{2}\\,|1\\rangle",
      },
      { kind: "p", text: "The arrow's position on the sphere comes straight from those angles:" },
      {
        kind: "math",
        tex: "x = \\sin\\theta\\cos\\varphi,\\quad y = \\sin\\theta\\sin\\varphi,\\quad z = \\cos\\theta",
      },
      { kind: "p", text: "The chance of measuring 0 depends only on the height:" },
      { kind: "math", tex: "P(0) = \\cos^2\\tfrac{\\theta}{2} = \\frac{1+z}{2}" },
      {
        kind: "p",
        text: "The density matrix holds the same information as a table. The diagonal is P(0) and P(1). The off-diagonal numbers are the coherence, how much of a superposition is left.",
      },
      {
        kind: "math",
        tex: "\\rho = \\tfrac{1}{2}\\left(I + xX + yY + zZ\\right) = \\begin{pmatrix} P(0) & \\rho_{01} \\\\ \\rho_{01}^{*} & P(1) \\end{pmatrix}",
      },
      { kind: "p", text: "Purity says how close the state is to pure:" },
      {
        kind: "math",
        tex: "\\operatorname{Tr}\\rho^2 = \\frac{1+x^2+y^2+z^2}{2}",
        caption: "1 is pure, 1/2 is completely mixed.",
      },
    ],
  },
  {
    id: "noise",
    title: "Hardware reality check",
    blocks: [
      {
        kind: "p",
        text: "Real qubits aren't perfectly isolated. The Hardware reality check card lets time pass and shows two kinds of noise.",
      },
      {
        kind: "list",
        items: [
          "T1 is relaxation. The qubit leaks energy and slides toward |0⟩, so the arrow sinks toward the north pole.",
          "T2 is dephasing. The qubit loses its phase without changing its odds, so the sideways part of the arrow (x and y) shrinks.",
          "Physics says T2 can never be more than 2·T1, so the T2 slider stops there.",
        ],
      },
      {
        kind: "math",
        tex: "x,\\,y \\to e^{-t/T_2}\\,(x,\\,y), \\qquad z \\to 1 + (z-1)\\,e^{-t/T_1}",
      },
      {
        kind: "p",
        text: "When the arrow is shorter than the sphere's radius the state is mixed: we only know probabilities, not an exact state. Its length is set by the purity:",
      },
      { kind: "math", tex: "|\\vec r| = \\sqrt{2\\operatorname{Tr}\\rho^2 - 1}" },
      {
        kind: "p",
        text: "A state in the lower half can look more mixed for a while and then become pure again as T1 pulls it into |0⟩. That is correct, not a bug. The faint arrow is where the state would be with no noise.",
      },
    ],
  },
  {
    id: "limits",
    title: "What this doesn't show",
    blocks: [
      {
        kind: "list",
        items: [
          "Only one qubit. Entanglement needs two or more and can't be drawn on a single Bloch sphere.",
          "Global phase, which can't be measured, is left out on purpose.",
          "The noise is a standard textbook model with adjustable numbers. It isn't the calibration of any specific machine.",
        ],
      },
    ],
  },
];
