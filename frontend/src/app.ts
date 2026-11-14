import { checkAgainstServer, type CheckResult } from "./api/noise";
import { ManualSliders } from "./components/ManualSliders";
import { MathHUD } from "./components/MathHUD";
import { RealityCheck } from "./components/RealityCheck";
import { evolveBloch, type Noise } from "./math/decoherence";
import {
  GATES,
  anglesFromState,
  applyGate,
  blochVector,
  normalize,
  oneState,
  purityFromBloch,
  stateFromAngles,
  zeroState,
  type Vec2,
  type Vec3,
} from "./math/quantum";

/** What the UI needs from a 3D scene. BlochScene implements it; tests can pass a fake. */
export interface SceneLike {
  setTarget(v: Vec3): void;
  snapTo(v: Vec3): void;
  /** Optional: faint marker for the state without noise. */
  setGhost?(v: Vec3 | null): void;
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
  /** The Bloch vector on screen right now (shorter than 1 once noise has acted). */
  getShownBloch: () => Vec3;
  /** Collapse the state like the Measure button; `source` (e.g. "open palm") is shown after the result. */
  measureNow: (source?: string) => void;
}

/** Wires the controls to the scene. The quantum state itself lives here, computed by math/quantum. */
export function startApp(dock: HTMLElement, scene: SceneLike): AppHandle {
  let state: Vec2 = zeroState();
  let phiMemory = 0; // azimuth is undefined at the poles, so remember the last real one
  const hud = new MathHUD();
  const noise = new RealityCheck({ onChange: () => show(lastNote) });
  let lastNote = "";
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  let checkId = 0;

  // The prepared state is always pure. What you see is that state after noise.t of decay.
  const shownBloch = (): Vec3 => evolveBloch(blochVector(state), noise.current);

  const show = (note: string): void => {
    lastNote = note;
    const bloch = shownBloch();
    const mixed = noise.current.t > 0 && Math.hypot(...bloch) < 1 - 1e-9;
    scene.setTarget(bloch);
    scene.setGhost?.(mixed ? blochVector(state) : null);
    if (mixed) hud.showMixed(bloch, note);
    else hud.show(state, note);
    noise.showPurity(purityFromBloch(bloch));
    scheduleCheck(bloch);
  };

  // Ask the backend the same question, a moment after the sliders stop moving.
  const scheduleCheck = (local: Vec3): void => {
    clearTimeout(checkTimer);
    const settings: Noise = noise.current;
    if (settings.t === 0) {
      checkId++;
      noise.showCheck(null);
      return;
    }
    const id = ++checkId;
    checkTimer = setTimeout(async () => {
      const [theta, phi] = anglesFromState(state);
      const result: CheckResult = await checkAgainstServer({ theta, phi, ...settings }, local);
      if (id === checkId) noise.showCheck(result);
    }, 300);
  };

  const apply = (
    next: Vec2,
    options: { note?: string; syncSliders?: boolean; phi?: number } = {},
  ): void => {
    state = normalize(next);
    const [theta, phi] = anglesFromState(state);
    const atPole = Math.sin(theta) < 1e-6;
    if (options.phi !== undefined) phiMemory = options.phi;
    else if (!atPole) phiMemory = phi;
    show(options.note ?? "");
    if (options.syncSliders !== false) {
      tray.setAngles(theta, options.phi ?? (atPole ? null : phi));
    }
  };

  const collapse = (source?: string): void => {
    // The odds come from what the noisy qubit looks like now; the result is a fresh pure state.
    const [, , z] = shownBloch();
    const outcome = Math.random() < (1 + z) / 2 ? 0 : 1;
    noise.rewind();
    apply(outcome === 0 ? zeroState() : oneState(), {
      note: `Measured |${outcome}⟩${source ? ` (${source})` : ""}`,
    });
  };

  const tray = new ManualSliders({
    onAngles: (theta, phi) => apply(stateFromAngles(theta, phi), { syncSliders: false, phi }),
    onGate: (name) => apply(applyGate(GATES[name], state), { note: `Applied ${name}` }),
    onReset: () => apply(zeroState(), { note: "Reset to |0⟩" }),
    onMeasure: () => collapse(),
  });

  dock.append(hud.element, tray.element, noise.element);
  scene.snapTo(blochVector(state));
  show("");
  tray.setAngles(0, 0);

  return {
    getState: () => state,
    getAngles: () => {
      const [theta] = anglesFromState(state);
      return { theta, phi: phiMemory };
    },
    steer: (theta, phi) =>
      apply(stateFromAngles(theta, phi), { note: "Steering with your hand", phi }),
    getShownBloch: shownBloch,
    measureNow: (source) => collapse(source),
  };
}
