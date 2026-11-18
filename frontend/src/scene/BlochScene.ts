import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Vec3 } from "../math/quantum";
import { FrameStats } from "../perf/FrameStats";
import { timed } from "../perf/marks";
import { QualityGovernor } from "../perf/QualityGovernor";
import { RenderGate } from "../perf/RenderGate";
import { StateAnimator } from "./animator";
import { GhostVector } from "./GhostVector";
import { SphereMesh } from "./SphereMesh";
import { StateVector } from "./StateVector";

const NORMAL_OMEGA = 14; // spring stiffness: the needle settles in about 0.3 s
const REDUCED_MOTION_OMEGA = 60; // nearly instant for people who ask for less motion

function disposeTree(root: THREE.Object3D): void {
  root.traverse((object: THREE.Object3D) => {
    const item = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    item.geometry?.dispose();
    const materials = Array.isArray(item.material) ? item.material : [item.material];
    for (const material of materials) {
      if (!material) continue;
      (material as THREE.Material & { map?: THREE.Texture | null }).map?.dispose();
      material.dispose();
    }
  });
}

/** Owns the renderer, camera, controls and animation loop. */
export class BlochScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  private readonly controls: OrbitControls;
  private readonly sphere: SphereMesh;
  private readonly vector = new StateVector();
  private readonly ghost = new GhostVector();
  private readonly ghostAnimator: StateAnimator;
  private ghostShown = false;
  private readonly animator: StateAnimator;
  private readonly resizeObserver: ResizeObserver;
  private readonly container: HTMLElement;
  private readonly motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  private frameId = 0;
  private last = performance.now();
  private readonly gate = new RenderGate();
  private readonly governor = new QualityGovernor(Math.min(window.devicePixelRatio, 2));
  private contextLost = false;
  private contextListener: ((state: "lost" | "restored") => void) | null = null;

  /** Recent frame times, for the ?perf overlay. */
  readonly stats = new FrameStats();

  static async create(container: HTMLElement): Promise<BlochScene> {
    return new BlochScene(container, await SphereMesh.create());
  }

  private constructor(container: HTMLElement, sphere: SphereMesh) {
    this.container = container;
    this.sphere = sphere;
    this.animator = new StateAnimator(
      this.motionQuery.matches ? REDUCED_MOTION_OMEGA : NORMAL_OMEGA,
    );

    this.ghostAnimator = new StateAnimator(
      this.motionQuery.matches ? REDUCED_MOTION_OMEGA : NORMAL_OMEGA,
    );

    // alpha: true lets the cream page background (and its paper grain) show through
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(this.governor.pixelRatio);
    const canvas = this.renderer.domElement;
    canvas.className = "qv-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Interactive Bloch sphere showing the qubit state");
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    container.appendChild(canvas);

    this.scene.add(this.sphere.group, this.vector.group, this.ghost.group);

    // Camera looks at the sphere from the front-left and slightly above, like a textbook figure.
    this.camera.position.set(4.25, 1.98, 2.46);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.7;
    this.controls.minDistance = 2.8;
    this.controls.maxDistance = 9;
    this.controls.minPolarAngle = 0.15;
    this.controls.maxPolarAngle = Math.PI - 0.15;
    this.controls.target.set(0, 0, 0);

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.motionQuery.addEventListener("change", this.onMotionPreference);
    this.resize();
    this.frameId = requestAnimationFrame(this.frame);
  }

  get pixelRatio(): number {
    return this.governor.pixelRatio;
  }

  /** Called when the browser takes the graphics context away and when it gives it back. */
  onContextChange(listener: (state: "lost" | "restored") => void): void {
    this.contextListener = listener;
  }

  /** Animate the needle to a new Bloch vector (x, y, z). Length < 1 means a mixed state. */
  setTarget(v: Vec3): void {
    this.animator.setTarget(v);
    this.gate.invalidate();
  }

  /** Faint marker for the noise-free state. null hides it. */
  setGhost(v: Vec3 | null): void {
    if (v && !this.ghostShown) this.ghostAnimator.snapTo(v);
    else if (v) this.ghostAnimator.setTarget(v);
    this.ghostShown = v !== null;
    this.gate.invalidate();
  }

  /** Jump straight to a Bloch vector without animating. */
  snapTo(v: Vec3): void {
    this.animator.snapTo(v);
    this.gate.invalidate();
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.motionQuery.removeEventListener("change", this.onMotionPreference);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.controls.dispose();
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault(); // without this the browser never tries to restore it
    this.contextLost = true;
    this.contextListener?.("lost");
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.gate.invalidate();
    this.contextListener?.("restored");
  };

  private readonly onMotionPreference = (): void => {
    const omega = this.motionQuery.matches ? REDUCED_MOTION_OMEGA : NORMAL_OMEGA;
    this.animator.setOmega(omega);
    this.ghostAnimator.setOmega(omega);
  };

  private readonly resize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false); // clears the canvas, so draw again
    this.gate.invalidate();
    this.camera.aspect = width / height;
    // On narrow screens pull back so the whole sphere and its labels still fit.
    this.camera.zoom = Math.min(1, this.camera.aspect);
    this.camera.updateProjectionMatrix();
  };

  private readonly frame = (now: number): void => {
    const elapsed = now - this.last;
    const dt = Math.min(elapsed / 1000, 0.05);
    this.last = now;
    // a long gap means the tab was in the background, which says nothing about speed
    if (elapsed < 250) this.stats.add(elapsed);

    const moving = timed("update", () => {
      this.animator.step(dt);
      this.ghostAnimator.step(dt);
      this.vector.update(this.animator.bloch, this.animator.phi);
      this.ghost.update(this.ghostShown ? this.ghostAnimator.bloch : null);
      const orbiting = this.controls.update();
      const ghostMoving = this.ghostShown && !this.ghostAnimator.settled;
      return orbiting || !this.animator.settled || ghostMoving;
    });

    // Nothing moved: skip the draw and leave the GPU to the hand tracker.
    if (!this.contextLost && this.gate.shouldRender(moving)) {
      timed("render", () => this.renderer.render(this.scene, this.camera));
    }

    if (moving && this.stats.count >= 30) {
      const ratio = this.governor.update(now, this.stats.fps);
      if (ratio !== null) {
        this.renderer.setPixelRatio(ratio);
        this.stats.reset();
        this.resize();
      }
    } else {
      this.governor.idle();
    }
    this.frameId = requestAnimationFrame(this.frame);
  };
}
