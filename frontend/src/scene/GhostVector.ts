import * as THREE from "three";
import type { Vec3 } from "../math/quantum";
import { blochToWorld } from "./coords";
import { COLORS } from "./theme";

/** A faint line and dot showing where the state would be if there were no noise. */
export class GhostVector {
  readonly group = new THREE.Group();
  private readonly positions = new Float32Array(6);
  private readonly attribute = new THREE.BufferAttribute(this.positions, 3);
  private readonly dot: THREE.Mesh;

  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", this.attribute);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: COLORS.violetSoft,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    line.frustumCulled = false;

    this.dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 16, 16),
      new THREE.MeshBasicMaterial({
        color: COLORS.violetSoft,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.group.add(line, this.dot);
    this.group.visible = false;
  }

  /** Pass null to hide it (no noise, so the real needle is already the pure state). */
  update(bloch: Vec3 | null): void {
    this.group.visible = bloch !== null;
    if (!bloch) return;
    const [x, y, z] = blochToWorld(bloch);
    this.positions.set([0, 0, 0, x, y, z]);
    this.attribute.needsUpdate = true;
    this.dot.position.set(x, y, z);
  }
}
