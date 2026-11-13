import { GATES } from "../math/quantum";

export type GateName = keyof typeof GATES;

export interface TrayHandlers {
  onAngles(thetaRad: number, phiRad: number): void;
  onGate(name: GateName): void;
  onReset(): void;
  onMeasure(): void;
}

const GATE_NAMES = Object.keys(GATES) as GateName[];
const GATE_HINTS: Record<GateName, string> = {
  X: "Pauli X: flips |0⟩ and |1⟩ (half turn about x)",
  Y: "Pauli Y: half turn about y",
  Z: "Pauli Z: phase flip (half turn about z)",
  H: "Hadamard: turns |0⟩ into |+⟩ (z to x)",
  S: "Phase S: quarter turn about z",
  T: "Phase T: eighth turn about z",
};
const DEG = 180 / Math.PI;

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

interface SliderRow {
  row: HTMLElement;
  input: HTMLInputElement;
  output: HTMLOutputElement;
}

function sliderRow(id: string, symbol: string, name: string, max: number): SliderRow {
  const row = make("div", "qv-row");
  const label = make("label", "qv-row__label", symbol);
  label.htmlFor = id;
  label.title = name;
  const input = make("input", "qv-range");
  input.type = "range";
  input.id = id;
  input.min = "0";
  input.max = String(max);
  input.step = "0.5";
  input.value = "0";
  input.setAttribute("aria-label", `${name} in degrees`);
  const output = make("output", "qv-row__value", "0.0°");
  output.setAttribute("aria-live", "off"); // <output> is a live region by default; gestures would flood screen readers
  output.htmlFor = id;
  row.append(label, input, output);
  return { row, input, output };
}

/** Manual controls: exact θ/φ sliders and gate buttons. Also the fallback when there is no camera. */
export class ManualSliders {
  readonly element: HTMLElement;
  private readonly theta: SliderRow;
  private readonly phi: SliderRow;

  constructor(private readonly handlers: TrayHandlers) {
    this.element = make("section", "qv-card qv-tray");
    this.element.setAttribute("aria-label", "Manual controls");
    this.element.append(make("h2", undefined, "Controls"));

    this.theta = sliderRow("qv-theta", "θ", "Polar angle theta", 180);
    this.phi = sliderRow("qv-phi", "φ", "Azimuth phi", 360);
    for (const slider of [this.theta, this.phi]) {
      slider.input.addEventListener("input", () => this.emitAngles());
      this.element.append(slider.row);
    }

    const gates = make("div", "qv-buttons");
    gates.setAttribute("role", "group");
    gates.setAttribute("aria-label", "Quantum gates");
    for (const name of GATE_NAMES) {
      const button = make("button", "qv-btn", name);
      button.type = "button";
      button.dataset.gate = name;
      button.title = GATE_HINTS[name];
      button.setAttribute("aria-label", GATE_HINTS[name]);
      button.addEventListener("click", () => handlers.onGate(name));
      gates.append(button);
    }

    const actions = make("div", "qv-buttons");
    const reset = make("button", "qv-btn", "Reset |0⟩");
    reset.type = "button";
    reset.dataset.action = "reset";
    reset.addEventListener("click", () => handlers.onReset());
    const measure = make("button", "qv-btn qv-btn--primary", "Measure");
    measure.type = "button";
    measure.dataset.action = "measure";
    measure.title = "Collapse the state to |0⟩ or |1⟩ with the Born-rule probabilities";
    measure.addEventListener("click", () => handlers.onMeasure());
    actions.append(reset, measure);

    this.element.append(gates, actions);
  }

  /** Move the sliders without firing events. Pass phi = null to leave φ where it is (poles). */
  setAngles(thetaRad: number, phiRad: number | null): void {
    this.theta.input.value = String(thetaRad * DEG);
    this.describe(this.theta);
    if (phiRad !== null) {
      this.phi.input.value = String(phiRad * DEG);
      this.describe(this.phi);
    }
  }

  private emitAngles(): void {
    this.describe(this.theta);
    this.describe(this.phi);
    this.handlers.onAngles(
      this.theta.input.valueAsNumber / DEG,
      this.phi.input.valueAsNumber / DEG,
    );
  }

  /** Keeps the visible value and the screen-reader value in step with the slider. */
  private describe(slider: SliderRow): void {
    const degrees = slider.input.valueAsNumber;
    slider.output.textContent = `${degrees.toFixed(1)}°`;
    slider.input.setAttribute("aria-valuetext", `${degrees.toFixed(1)} degrees`);
  }
}
