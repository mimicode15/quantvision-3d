import * as THREE from "three";
import type { Vec3 } from "../math/quantum";
import { blochToWorld } from "./coords";
import {
  WEDGE_SEGMENTS,
  fillWorldPositions,
  needleDimensions,
  shadowPoints,
  wedgeFan,
  wedgeIndices,
} from "./geometry";
import { COLORS } from "./theme";

const SHAFT_RADIUS = 0.008;
const UP = new THREE.Vector3(0, 1, 0);

function dynamicLine(material: THREE.Material, positions: Float32Array) {
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false; // its points move every frame
  return { line, attribute };
}

/**
 * The statevector needle plus its mathematical "shadow": a dashed drop line to the equatorial
 * plane, a footprint dot, a line to the centre, and a protractor wedge measuring the azimuth.
 */
export class StateVector {
  readonly group = new THREE.Group();

  private readonly needle = new THREE.Group();
  private readonly shaft: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly direction = new THREE.Vector3();

  private readonly shadow: THREE.Line;
  private readonly shadowAttribute: THREE.BufferAttribute;
  private readonly shadowPositions = new Float32Array(6);

  private readonly projection: THREE.Line;
  private readonly projectionAttribute: THREE.BufferAttribute;
  private readonly projectionPositions = new Float32Array(6);

  private readonly footprint: THREE.Mesh;

  private readonly wedge: THREE.Mesh;
  private readonly wedgeAttribute: THREE.BufferAttribute;
  private readonly wedgePositions = new Float32Array((WEDGE_SEGMENTS + 2) * 3);

  constructor() {
    const violet = new THREE.MeshBasicMaterial({ color: COLORS.violet });

    // Unit-size shapes with their base at y = 0, so scaling sets length and radius directly.
    const shaftGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
    shaftGeometry.translate(0, 0.5, 0);
    const headGeometry = new THREE.ConeGeometry(1, 1, 24);
    headGeometry.translate(0, 0.5, 0);
    this.shaft = new THREE.Mesh(shaftGeometry, violet);
    this.head = new THREE.Mesh(headGeometry, violet);
    this.needle.add(this.shaft, this.head);

    const dashed = new THREE.LineDashedMaterial({
      color: COLORS.violet,
      dashSize: 0.035,
      gapSize: 0.03,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    ({ line: this.shadow, attribute: this.shadowAttribute } = dynamicLine(
      dashed,
      this.shadowPositions,
    ));

    const soft = new THREE.LineBasicMaterial({
      color: COLORS.violetSoft,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    ({ line: this.projection, attribute: this.projectionAttribute } = dynamicLine(
      soft,
      this.projectionPositions,
    ));

    this.footprint = new THREE.Mesh(
      new THREE.CircleGeometry(0.03, 24),
      new THREE.MeshBasicMaterial({
        color: COLORS.violetSoft,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.footprint.rotation.x = -Math.PI / 2;

    const wedgeGeometry = new THREE.BufferGeometry();
    this.wedgeAttribute = new THREE.BufferAttribute(this.wedgePositions, 3);
    wedgeGeometry.setAttribute("position", this.wedgeAttribute);
    wedgeGeometry.setIndex(wedgeIndices());
    this.wedge = new THREE.Mesh(
      wedgeGeometry,
      new THREE.MeshBasicMaterial({
        color: COLORS.violetSoft,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.wedge.frustumCulled = false;

    for (const [object, order] of [
      [this.wedge, 5],
      [this.projection, 6],
      [this.shadow, 6],
      [this.footprint, 7],
    ] as const) {
      object.renderOrder = order;
    }
    this.group.add(this.wedge, this.projection, this.shadow, this.footprint, this.needle);
  }

  /** `bloch` is the display vector (length 1 for pure states); `phi` is its wrapped azimuth. */
  update(bloch: Vec3, phi: number): void {
    const [x, y, z] = bloch;
    const length = Math.hypot(x, y, z);
    const horizontal = Math.hypot(x, y);

    const hasNeedle = length > 1e-3;
    this.needle.visible = hasNeedle;
    if (hasNeedle) {
      const [wx, wy, wz] = blochToWorld(bloch);
      this.direction.set(wx / length, wy / length, wz / length);
      this.needle.quaternion.setFromUnitVectors(UP, this.direction);
      const dims = needleDimensions(length);
      this.shaft.visible = dims.shaft > 1e-4;
      this.shaft.scale.set(SHAFT_RADIUS, Math.max(dims.shaft, 1e-4), SHAFT_RADIUS);
      this.head.position.y = dims.shaft;
      this.head.scale.set(dims.headRadius, dims.head, dims.headRadius);
    }

    const hasFootprint = hasNeedle && horizontal > 0.01;
    const { tip, foot } = shadowPoints(bloch);

    this.shadow.visible = hasFootprint && Math.abs(z) > 0.01;
    if (this.shadow.visible) {
      fillWorldPositions(this.shadowPositions, [tip, foot]);
      this.shadowAttribute.needsUpdate = true;
      this.shadow.computeLineDistances();
    }

    this.projection.visible = hasFootprint;
    this.footprint.visible = hasFootprint;
    if (hasFootprint) {
      fillWorldPositions(this.projectionPositions, [[0, 0, 0], foot], 0.002);
      this.projectionAttribute.needsUpdate = true;
      const [fx, fy, fz] = blochToWorld(foot);
      this.footprint.position.set(fx, fy + 0.003, fz);
    }

    this.wedge.visible = horizontal > 0.02;
    if (this.wedge.visible) {
      fillWorldPositions(this.wedgePositions, wedgeFan(phi), 0.001);
      this.wedgeAttribute.needsUpdate = true;
    }
  }
}
