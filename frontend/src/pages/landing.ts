import { GITHUB_URL } from "../content/links";
import { make } from "../dom";

// A small drawing of the Bloch sphere for the hero. Decorative, so it is hidden from screen readers.
const SPHERE_SVG = `
<svg viewBox="0 0 320 320" aria-hidden="true" focusable="false">
  <circle cx="160" cy="160" r="110" fill="none" stroke="#4E9B9A" stroke-width="1.5" />
  <ellipse cx="160" cy="160" rx="110" ry="34" fill="rgba(168,218,220,0.25)" stroke="#4E9B9A" stroke-width="1.2" />
  <ellipse cx="160" cy="160" rx="42" ry="110" fill="none" stroke="#A8DADC" stroke-width="1.2" />
  <line x1="160" y1="30" x2="160" y2="290" stroke="#4E9B9A" stroke-width="1" />
  <line x1="160" y1="160" x2="226" y2="84" stroke="#7C3AED" stroke-width="4" stroke-linecap="round" />
  <polygon points="236,72 214,80 228,94" fill="#7C3AED" />
  <line x1="226" y1="84" x2="226" y2="170" stroke="#7C3AED" stroke-width="1.2" stroke-dasharray="4 4" />
  <circle cx="226" cy="170" r="4" fill="#C4B5FD" />
  <text x="160" y="20" text-anchor="middle" font-family="Syne Mono, monospace" font-size="15" fill="#1F2937">|0⟩</text>
  <text x="160" y="312" text-anchor="middle" font-family="Syne Mono, monospace" font-size="15" fill="#1F2937">|1⟩</text>
</svg>`;

const section = (id: string, title: string, intro: string, body: HTMLElement): HTMLElement => {
  const el = make("section", "qv-home__section");
  el.id = id;
  const heading = make("h2", undefined, title);
  el.append(heading, make("p", "qv-home__intro", intro), body);
  return el;
};

const card = (title: string, text: string): HTMLElement => {
  const el = make("article", "qv-glass");
  el.append(make("h3", undefined, title), make("p", undefined, text));
  return el;
};

const grid = (...cards: HTMLElement[]): HTMLElement => {
  const el = make("div", "qv-home__grid");
  el.append(...cards);
  return el;
};

function link(label: string, href: string, className = "qv-btn"): HTMLAnchorElement {
  const a = make("a", className, label);
  a.href = href;
  return a;
}

export function mountLanding(root: HTMLElement): () => void {
  const page = make("div", "qv-home");

  // ---- hero
  const hero = make("header", "qv-home__hero");
  const copy = make("div", "qv-home__copy");
  const play = link("Launch the playground", "#/play", "qv-btn qv-btn--primary qv-btn--big");
  const learn = make("button", "qv-btn qv-btn--big", "How it works");
  learn.type = "button";
  learn.addEventListener("click", () => {
    page.querySelector("#qubit")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const actions = make("div", "qv-buttons");
  actions.append(play, learn);
  copy.append(
    make("p", "qv-home__eyebrow", "A quantum computing visualizer"),
    make("h1", undefined, "QuantVision"),
    make(
      "p",
      "qv-home__lead",
      "Steer a qubit with your hand, then see what real hardware does to it.",
    ),
    actions,
  );
  const figure = make("div", "qv-home__figure");
  figure.innerHTML = SPHERE_SVG;
  hero.append(copy, figure);

  // ---- sections
  const qubit = section(
    "qubit",
    "What is a qubit?",
    "A bit is 0 or 1. A qubit can be in a blend of both. The blend decides the odds you get when you measure it.",
    grid(
      card(
        "Superposition",
        "Before you look, the state can be part |0⟩ and part |1⟩. How much of each is the whole point.",
      ),
      card(
        "Measurement",
        "Looking forces an answer, 0 or 1, at random with those odds. Afterward the qubit stays at that answer.",
      ),
      card(
        "Phase",
        "A second number with no everyday analogy. It doesn't change the odds now, but it changes what gates do later.",
      ),
    ),
  );

  const readSphere = make("ul", "qv-home__list");
  for (const text of [
    "North pole is |0⟩ and south pole is |1⟩.",
    "The higher the arrow, the more likely a 0.",
    "The angle around the sphere is the phase.",
    "Gates are rotations. Measuring makes the arrow jump to a pole.",
  ]) {
    readSphere.append(make("li", undefined, text));
  }
  const sphere = section(
    "sphere",
    "Read the sphere",
    "One qubit's whole state fits on a sphere. The arrow shows which state it is in right now.",
    readSphere,
  );

  const hands = section(
    "hands",
    "Use your hands",
    "Your webcam tracks one hand. No camera? The sliders and gate buttons do the same job.",
    grid(
      card(
        "Pinch and move up or down",
        "Thumb and first finger together grabs the arrow. Height sets θ.",
      ),
      card(
        "Tilt your wrist",
        "While pinching, tilt left or right to turn the arrow around the sphere (φ).",
      ),
      card(
        "Open palm to measure",
        "Hold a flat hand still for about a second. The state collapses.",
      ),
    ),
  );
  hands.append(
    make(
      "p",
      "qv-home__note",
      "Hand tracking runs in your browser. The video never leaves your computer.",
    ),
  );

  const noise = section(
    "noise",
    "Real hardware is noisy",
    "Today's qubits leak. Let time pass in the playground and watch the arrow shrink.",
    grid(
      card("T1: relaxation", "The qubit loses energy and slides toward |0⟩."),
      card("T2: dephasing", "The qubit forgets its phase. The sideways part of the arrow fades."),
      card(
        "Mixed states",
        "A shorter arrow means we only know probabilities. That is why long programs are hard to run.",
      ),
    ),
  );

  const stack = make("ul", "qv-home__list");
  for (const text of [
    "Three.js draws the sphere and MediaPipe tracks your hand, both in the browser.",
    "A FastAPI backend does the same math in NumPy.",
    "Tests check that NumPy matches Qiskit's results.",
  ]) {
    stack.append(make("li", undefined, text));
  }
  const open = section(
    "open",
    "Built in the open",
    "The code is on GitHub, with the math checked against Qiskit.",
    stack,
  );
  const repo = link("View the source on GitHub", GITHUB_URL);
  repo.target = "_blank";
  repo.rel = "noopener noreferrer";
  const repoRow = make("div", "qv-buttons");
  repoRow.append(repo);
  open.append(repoRow);

  const footer = make("footer", "qv-home__footer");
  footer.append(
    make(
      "p",
      undefined,
      "QuantVision models a single qubit. Entanglement needs two or more and isn't shown here.",
    ),
    link("Open the playground", "#/play", "qv-btn qv-btn--primary"),
  );

  page.append(hero, qubit, sphere, hands, noise, open, footer);
  root.append(page);
  return () => page.remove();
}
