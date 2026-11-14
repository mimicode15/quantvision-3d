import { describePurity, clampT2, type Noise } from "../math/decoherence";
import type { CheckResult } from "../api/noise";

export interface RealityHandlers {
  onChange(noise: Noise): void;
}

export const LIMITS = { t1: [5, 300], t2: [5, 600], t: [0, 300] } as const;
export const DEFAULT_NOISE: Noise = { t: 0, t1: 100, t2: 80 };
const PLAY_SECONDS = 6;

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

function row(id: string, symbol: string, name: string, [min, max]: readonly [number, number]) {
  const wrap = make("div", "qv-row");
  const label = make("label", "qv-row__label", symbol);
  label.htmlFor = id;
  label.title = name;
  const input = make("input", "qv-range");
  input.type = "range";
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.setAttribute("aria-label", `${name} in microseconds`);
  const output = make("output", "qv-row__value");
  output.htmlFor = id;
  output.setAttribute("aria-live", "off");
  wrap.append(label, input, output);
  return { wrap, input, output };
}

/** The "hardware reality check" card: T1, T2 and elapsed time sliders plus a purity readout. */
export class RealityCheck {
  readonly element: HTMLElement;
  private noise: Noise = { ...DEFAULT_NOISE };
  private readonly t1 = row("qv-t1", "T1", "Relaxation time T1", LIMITS.t1);
  private readonly t2 = row("qv-t2", "T2", "Dephasing time T2", LIMITS.t2);
  private readonly time = row("qv-time", "t", "Elapsed time t", LIMITS.t);
  private readonly purityLine = make("p", "qv-reality__purity");
  private readonly checkLine = make("p", "qv-reality__check");
  private readonly play = make("button", "qv-btn", "Play");
  private frame = 0;

  constructor(private readonly handlers: RealityHandlers) {
    this.element = make("section", "qv-card qv-reality");
    this.element.setAttribute("aria-label", "Hardware reality check");
    this.element.append(make("h2", undefined, "Hardware reality check"));

    this.element.append(
      make(
        "p",
        "qv-reality__intro",
        "Real qubits leak. Let time pass and the needle shrinks as the state turns mixed.",
      ),
    );

    for (const slider of [this.t1, this.t2, this.time]) {
      slider.input.addEventListener("input", () => this.read());
      this.element.append(slider.wrap);
    }
    this.element.append(
      make("p", "qv-reality__limit", "T2 can't be more than 2·T1, so the T2 slider stops there."),
    );

    this.play.type = "button";
    this.play.addEventListener("click", () => (this.frame ? this.stop() : this.start()));
    const reset = make("button", "qv-btn", "Reset noise");
    reset.type = "button";
    reset.addEventListener("click", () => this.set({ ...DEFAULT_NOISE }));
    const buttons = make("div", "qv-buttons");
    buttons.append(this.play, reset);

    this.purityLine.setAttribute("aria-live", "polite");
    this.element.append(buttons, this.purityLine, this.checkLine);
    this.set({ ...DEFAULT_NOISE }, false);
  }

  get current(): Noise {
    return this.noise;
  }

  /** Back to t = 0 without touching T1 and T2 (used after a measurement). */
  rewind(): void {
    this.stop();
    this.set({ ...this.noise, t: 0 }, false);
  }

  /** Update the readouts (called by the app after it works out the purity). */
  showPurity(purity: number): void {
    this.purityLine.textContent = describePurity(purity);
  }

  showCheck(result: CheckResult | null): void {
    if (!result) {
      this.checkLine.textContent = "";
      return;
    }
    if (result.status === "agree") {
      this.checkLine.textContent = `Backend agrees (max difference ${result.maxDiff.toExponential(1)}).`;
    } else if (result.status === "differ") {
      this.checkLine.textContent = `Backend disagrees by ${result.maxDiff.toExponential(1)}. That's a bug.`;
    } else {
      this.checkLine.textContent = "Backend offline: using the in-browser model.";
    }
    this.checkLine.dataset.status = result.status;
  }

  private read(): void {
    this.stop();
    this.set({
      t: this.time.input.valueAsNumber,
      t1: this.t1.input.valueAsNumber,
      t2: this.t2.input.valueAsNumber,
    });
  }

  private set(next: Noise, notify = true): void {
    this.noise = { ...next, t2: clampT2(next.t1, next.t2) };
    this.t1.input.value = String(this.noise.t1);
    this.t2.input.value = String(this.noise.t2);
    this.t2.input.max = String(Math.min(LIMITS.t2[1], 2 * this.noise.t1));
    this.time.input.value = String(this.noise.t);
    this.t1.output.textContent = `${Math.round(this.noise.t1)} µs`;
    this.t2.output.textContent = `${Math.round(this.noise.t2)} µs`;
    this.time.output.textContent = `${Math.round(this.noise.t)} µs`;
    if (notify) this.handlers.onChange(this.noise);
  }

  private start(): void {
    const [, end] = LIMITS.t;
    if (this.noise.t >= end) this.set({ ...this.noise, t: 0 });
    const from = this.noise.t;
    const began = performance.now();
    this.play.textContent = "Pause";
    const tick = (now: number): void => {
      const progress = Math.min((now - began) / (PLAY_SECONDS * 1000), 1);
      this.set({ ...this.noise, t: from + (end - from) * progress });
      if (progress < 1) this.frame = requestAnimationFrame(tick);
      else this.stop();
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.play.textContent = "Play";
  }
}
