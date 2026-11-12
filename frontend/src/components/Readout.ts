import { anglesFromState, blochVector, measurementProbabilities, type Vec2 } from "../math/quantum";

const DEG = 180 / Math.PI;

const signed = (n: number): string => {
  const clean = Math.abs(n) < 5e-4 ? 0 : n;
  return `${clean < 0 ? "−" : "+"}${Math.abs(clean).toFixed(3)}`;
};

const FIELDS = [
  ["theta", "θ"],
  ["phi", "φ"],
  ["p0", "P(0)"],
  ["x", "x"],
  ["y", "y"],
  ["z", "z"],
] as const;

type Field = (typeof FIELDS)[number][0];

/** Live numbers for the current state. (The KaTeX Dirac/density-matrix HUD arrives on Day 6.) */
export class Readout {
  readonly element: HTMLElement;
  private readonly cells = {} as Record<Field, HTMLElement>;
  private readonly note: HTMLElement;

  constructor() {
    this.element = document.createElement("section");
    this.element.className = "qv-card qv-readout";
    this.element.setAttribute("aria-label", "Current state");
    const heading = document.createElement("h2");
    heading.textContent = "State";
    const list = document.createElement("dl");
    list.className = "qv-readout__grid";
    for (const [key, label] of FIELDS) {
      const group = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const value = document.createElement("dd");
      value.dataset.field = key;
      group.append(term, value);
      list.append(group);
      this.cells[key] = value;
    }
    this.note = document.createElement("p");
    this.note.className = "qv-readout__note";
    this.element.append(heading, list, this.note);
  }

  show(state: Vec2, note = ""): void {
    const [theta, phi] = anglesFromState(state);
    const [x, y, z] = blochVector(state);
    const [p0] = measurementProbabilities(state);
    this.cells.theta.textContent = `${(theta * DEG).toFixed(1)}°`;
    this.cells.phi.textContent = `${(phi * DEG).toFixed(1)}°`;
    this.cells.p0.textContent = p0.toFixed(3);
    this.cells.x.textContent = signed(x);
    this.cells.y.textContent = signed(y);
    this.cells.z.textContent = signed(z);
    this.note.textContent = note;
  }
}
