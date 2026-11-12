import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Vec3 } from "../math/quantum";
import { StateAnimator } from "./animator";
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
  private readonly animator: StateAnimator;
  private readonly resizeObserver: ResizeObserver;
  private readonly container: HTMLElement;
  private readonly motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  private frameId = 0;
  private last = performance.now();

  static async create(container: HTMLElement): Promise<BlochScene> {
    return new BlochScene(container, await SphereMesh.create());
  }

  private constructor(container: HTMLElement, sphere: SphereMesh) {
    this.container = container;
    this.sphere = sphere;
    this.animator = new StateAnimator(
      this.motionQuery.matches ? REDUCED_MOTION_OMEGA : NORMAL_OMEGA,
    );

    // alpha: true lets the cream page background (and its paper grain) show through
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const canvas = this.renderer.domElement;
    canvas.className = "qv-canvas";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Interactive Bloch sphere showing the qubit state");
    container.appendChild(canvas);

    this.scene.add(this.sphere.group, this.vector.group);

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

  /** Animate the needle to a new Bloch vector (x, y, z). Length < 1 means a mixed state. */
  setTarget(v: Vec3): void {
    this.animator.setTarget(v);
  }

  /** Jump straight to a Bloch vector without animating. */
  snapTo(v: Vec3): void {
    this.animator.snapTo(v);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.motionQuery.removeEventListener("change", this.onMotionPreference);
    this.controls.dispose();
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly onMotionPreference = (): void => {
    this.animator.setOmega(this.motionQuery.matches ? REDUCED_MOTION_OMEGA : NORMAL_OMEGA);
  };

  private readonly resize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // On narrow screens pull back so the whole sphere and its labels still fit.
    this.camera.zoom = Math.min(1, this.camera.aspect);
    this.camera.updateProjectionMatrix();
  };

  private readonly frame = (now: number): void => {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.animator.step(dt);
    this.vector.update(this.animator.bloch, this.animator.phi);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.frame);
  };
}
