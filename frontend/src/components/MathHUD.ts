import {
  GENERAL_STATE_TEX,
  densityMatrix,
  densityTex,
  diracTex,
  probabilities,
  purity,
} from "../math/hud";
import { anglesFromState, blochVector, type Vec2 } from "../math/quantum";

const DEG = 180 / Math.PI;

const signed = (n: number): string => {
  const clean = Math.abs(n) < 5e-4 ? 0 : n;
  return `${clean < 0 ? "−" : "+"}${Math.abs(clean).toFixed(3)}`;
};

/** The one KaTeX call we use. Injected so tests can run without a browser or the library. */
export interface KatexLike {
  render(
    tex: string,
    element: HTMLElement,
    options?: { throwOnError?: boolean; displayMode?: boolean },
  ): void;
}

/** KaTeX is ~270 KB, so it loads on demand; the numbers below work before it arrives. */
const loadKatex = async (): Promise<KatexLike> => {
  const { render } = await import("katex");
  return { render };
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

/**
 * The live math panel: the state as a Dirac ket, measurement probabilities, the full density
 * matrix, purity, and the raw Bloch numbers. Updates on every gate, slider move and gesture frame.
 */
export class MathHUD {
  readonly element: HTMLElement;
  private readonly cells = {} as Record<Field, HTMLElement>;
  private readonly dirac = make("div", "qv-hud__math qv-hud__dirac");
  private readonly rho = make("div", "qv-hud__math qv-hud__rho");
  private readonly general = make("p", "qv-hud__general");
  private readonly purityValue = make("span");
  private readonly purityLabel = make("span");
  private readonly bars: [HTMLElement, HTMLElement];
  private readonly probValues: [HTMLElement, HTMLElement];
  private readonly note = make("p", "qv-readout__note");
  /** The latest LaTeX per element, so each is re-rendered only when it changes. */
  private readonly shown = new Map<HTMLElement, string>();
  private readonly displayed = new Set<HTMLElement>();
  private katex: KatexLike | null = null;

  constructor(loader: () => Promise<KatexLike> = loadKatex) {
    this.element = make("section", "qv-card qv-hud");
    this.element.setAttribute("aria-label", "Current state");
    this.element.append(make("h2", undefined, "State"));

    this.dirac.setAttribute("aria-label", "State as a Dirac ket");
    this.rho.setAttribute("aria-label", "Density matrix");
    this.general.setAttribute("aria-hidden", "true");

    const probs = make("div", "qv-hud__probs");
    const row = (label: string) => {
      const line = make("div", "qv-hud__prob");
      const name = make("span", "qv-hud__prob-label", label);
      const track = make("div", "qv-hud__bar");
      const fill = make("span");
      track.append(fill);
      const value = make("span", "qv-hud__prob-value");
      line.append(name, track, value);
      probs.append(line);
      return { fill, value };
    };
    const p0 = row("P(0)");
    const p1 = row("P(1)");
    this.bars = [p0.fill, p1.fill];
    this.probValues = [p0.value, p1.value];

    const purityLine = make("p", "qv-hud__purity");
    purityLine.append("Tr ρ² = ", this.purityValue, " · ", this.purityLabel);

    const list = make("dl", "qv-readout__grid");
    for (const [key, label] of FIELDS) {
      const group = make("div");
      const value = make("dd");
      value.dataset.field = key;
      group.append(make("dt", undefined, label), value);
      list.append(group);
      this.cells[key] = value;
    }
    this.note.setAttribute("aria-live", "polite");

    this.element.append(this.dirac, this.general, probs, this.rho, purityLine, list, this.note);
    this.setMath(this.general, GENERAL_STATE_TEX);

    loader()
      .then((katex) => {
        this.katex = katex;
        for (const [el, tex] of this.shown) this.draw(el, tex); // upgrade the plain text already on screen
      })
      .catch(() => {
        /* KaTeX failed to load: the LaTeX source stays visible, which is still readable */
      });
  }

  show(state: Vec2, note = ""): void {
    const rho = densityMatrix(state);
    const [theta, phi] = anglesFromState(state);
    const [x, y, z] = blochVector(state);
    const [p0, p1] = probabilities(rho);
    const pure = purity(rho);

    this.setMath(this.dirac, diracTex(state));
    this.setMath(this.rho, densityTex(rho), true);

    [p0, p1].forEach((p, i) => {
      (this.bars[i] as HTMLElement).style.width =
        `${(Math.min(Math.max(p, 0), 1) * 100).toFixed(1)}%`;
      (this.probValues[i] as HTMLElement).textContent = p.toFixed(3);
    });
    this.purityValue.textContent = pure.toFixed(3);
    this.purityLabel.textContent = pure > 1 - 1e-9 ? "pure" : "mixed";

    this.cells.theta.textContent = `${(theta * DEG).toFixed(1)}°`;
    this.cells.phi.textContent = `${(phi * DEG).toFixed(1)}°`;
    this.cells.p0.textContent = p0.toFixed(3);
    this.cells.x.textContent = signed(x);
    this.cells.y.textContent = signed(y);
    this.cells.z.textContent = signed(z);
    this.note.textContent = note;
  }

  /** `display` centres the formula and stops KaTeX breaking it across lines (right for matrices). */
  private setMath(el: HTMLElement, tex: string, display = false): void {
    if (this.shown.get(el) === tex) return;
    this.shown.set(el, tex);
    if (display) this.displayed.add(el);
    this.draw(el, tex);
  }

  private draw(el: HTMLElement, tex: string): void {
    if (!this.katex) {
      el.textContent = tex;
      return;
    }
    try {
      this.katex.render(tex, el, {
        throwOnError: false,
        displayMode: this.displayed.has(el),
      });
    } catch {
      el.textContent = tex;
    }
  }
}
