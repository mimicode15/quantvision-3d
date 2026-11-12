import type { Vec3 } from "../math/quantum";
import { fromSpherical, toSpherical } from "./coords";
import { Spring, nearestAngle } from "./spring";

const TAU = 2 * Math.PI;

/**
 * Smooths the needle. Length, polar angle and azimuth each follow a critically damped spring,
 * so the tip glides along the sphere instead of cutting through it, and the azimuth always
 * takes the short way round. At a pole the azimuth is meaningless, so it is left alone.
 */
export class StateAnimator {
  private readonly length: Spring;
  private readonly theta: Spring;
  private readonly azimuth: Spring;

  constructor(omega = 14, initial: Vec3 = [0, 0, 1]) {
    this.length = new Spring(1, omega);
    this.theta = new Spring(0, omega);
    this.azimuth = new Spring(0, omega);
    this.snapTo(initial);
  }

  setOmega(omega: number): void {
    for (const spring of [this.length, this.theta, this.azimuth]) spring.omega = omega;
  }

  snapTo(v: Vec3): void {
    const s = toSpherical(v);
    this.length.snap(s.r);
    this.theta.snap(s.theta);
    if (s.azimuthDefined) this.azimuth.snap(s.phi);
  }

  setTarget(v: Vec3): void {
    const s = toSpherical(v);
    this.length.target = s.r;
    if (s.r === 0) return; // the origin has no direction: just shrink
    this.theta.target = s.theta;
    if (s.azimuthDefined) this.azimuth.target = nearestAngle(this.azimuth.value, s.phi);
  }

  step(dt: number): void {
    this.length.step(dt);
    this.theta.step(dt);
    this.azimuth.step(dt);
  }

  /** Needle length: 1 for a pure state, shrinking toward 0 as the state mixes. */
  get radius(): number {
    return Math.max(this.length.value, 0);
  }

  /** Current azimuth wrapped to 0..2pi (what the phase wedge shows). */
  get phi(): number {
    return ((this.azimuth.value % TAU) + TAU) % TAU;
  }

  get bloch(): Vec3 {
    return fromSpherical(this.radius, this.theta.value, this.azimuth.value);
  }

  get settled(): boolean {
    return this.length.settled && this.theta.settled && this.azimuth.settled;
  }
}
