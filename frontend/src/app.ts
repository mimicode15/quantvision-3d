import { ManualSliders } from "./components/ManualSliders";
import { MathHUD } from "./components/MathHUD";
import {
  GATES,
  anglesFromState,
  applyGate,
  blochVector,
  measure,
  normalize,
  stateFromAngles,
  zeroState,
  type Vec2,
  type Vec3,
} from "./math/quantum";

/** What the UI needs from a 3D scene. BlochScene implements it; tests can pass a fake. */
export interface SceneLike {
  setTarget(v: Vec3): void;
  snapTo(v: Vec3): void;
}

export interface Layout {
  stage: HTMLElement;
  dock: HTMLElement;
}

export function createLayout(root: HTMLElement): Layout {
  root.innerHTML = `
    <div class="qv-app">
      <header class="qv-header">
        <h1 class="qv-title">QuantVision</h1>
        <p class="qv-subtitle">One qubit on the Bloch sphere</p>
      </header>
      <main class="qv-stage"></main>
      <aside class="qv-dock" aria-label="State and controls"></aside>
      <p class="qv-hint">Drag to orbit · scroll to zoom</p>
    </div>`;
  const stage = root.querySelector<HTMLElement>(".qv-stage");
  const dock = root.querySelector<HTMLElement>(".qv-dock");
  if (!stage || !dock) throw new Error("layout failed to render");
  return { stage, dock };
}

/** What the rest of the app (gestures, tests) can do to the running UI. */
export interface AppHandle {
  getState: () => Vec2;
  /** Current polar and azimuth angles in radians. At a pole, phi is the last known azimuth. */
  getAngles: () => { theta: number; phi: number };
  /** Move the state to these angles, exactly as if the sliders had been dragged there. */
  steer: (theta: number, phi: number) => void;
  /** Collapse the state like the Measure button; `source` (e.g. "open palm") is shown after the result. */
  measureNow: (source?: string) => void;
}

/** Wires the controls to the scene. The quantum state itself lives here, computed by math/quantum. */
export function startApp(dock: HTMLElement, scene: SceneLike): AppHandle {
  let state: Vec2 = zeroState();
  let phiMemory = 0; // azimuth is undefined at the poles, so remember the last real one
  const hud = new MathHUD();

  const apply = (
    next: Vec2,
    options: { note?: string; syncSliders?: boolean; phi?: number } = {},
  ): void => {
    state = normalize(next);
    const [theta, phi] = anglesFromState(state);
    const atPole = Math.sin(theta) < 1e-6;
    if (options.phi !== undefined) phiMemory = options.phi;
    else if (!atPole) phiMemory = phi;
    scene.setTarget(blochVector(state));
    hud.show(state, options.note ?? "");
    if (options.syncSliders !== false) {
      tray.setAngles(theta, options.phi ?? (atPole ? null : phi));
    }
  };

  const collapse = (source?: string): void => {
    const { outcome, state: collapsed } = measure(state);
    apply(collapsed, { note: `Measured |${outcome}⟩${source ? ` (${source})` : ""}` });
  };

  const tray = new ManualSliders({
    onAngles: (theta, phi) => apply(stateFromAngles(theta, phi), { syncSliders: false, phi }),
    onGate: (name) => apply(applyGate(GATES[name], state), { note: `Applied ${name}` }),
    onReset: () => apply(zeroState(), { note: "Reset to |0⟩" }),
    onMeasure: () => collapse(),
  });

  dock.append(hud.element, tray.element);
  scene.snapTo(blochVector(state));
  hud.show(state);
  tray.setAngles(0, 0);

  return {
    getState: () => state,
    getAngles: () => {
      const [theta] = anglesFromState(state);
      return { theta, phi: phiMemory };
    },
    steer: (theta, phi) =>
      apply(stateFromAngles(theta, phi), { note: "Steering with your hand", phi }),
    measureNow: (source) => collapse(source),
  };
}
