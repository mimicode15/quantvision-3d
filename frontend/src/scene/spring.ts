const TAU = 2 * Math.PI;

/**
 * Critically damped spring, solved exactly, so it is stable at any frame time and never
 * overshoots from rest. `omega` is the stiffness: about 4/omega seconds to settle.
 */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  omega: number;

  constructor(initial = 0, omega = 14) {
    this.value = initial;
    this.target = initial;
    this.omega = omega;
  }

  step(dt: number): void {
    if (dt <= 0) return;
    const w = this.omega;
    const offset = this.value - this.target;
    const c = this.velocity + w * offset;
    const decay = Math.exp(-w * dt);
    this.value = this.target + (offset + c * dt) * decay;
    this.velocity = (this.velocity - w * c * dt) * decay;
  }

  snap(value: number): void {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  get settled(): boolean {
    return Math.abs(this.value - this.target) < 1e-4 && Math.abs(this.velocity) < 1e-3;
  }
}

/** The angle equal to `target` (mod 2pi) that lies closest to `current`: shortest way round. */
export function nearestAngle(current: number, target: number): number {
  return target + Math.round((current - target) / TAU) * TAU;
}
