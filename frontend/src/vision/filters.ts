/** Exponential smoothing step. alpha = 1 passes the input through; alpha near 0 barely moves. */
class LowPass {
  private last: number | null = null;

  filter(value: number, alpha: number): number {
    this.last = this.last === null ? value : alpha * value + (1 - alpha) * this.last;
    return this.last;
  }

  reset(): void {
    this.last = null;
  }
}

const smoothingFactor = (cutoffHz: number, dtSeconds: number): number => {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
};

/**
 * One Euro filter (Casiez et al., CHI 2012): heavy smoothing while the signal is nearly still,
 * light smoothing while it moves fast. That keeps a held hand steady without making a quick
 * flick feel laggy.
 *   minCutoff  Hz; lower = steadier at rest
 *   beta       how quickly the cutoff opens up with speed; higher = less lag when moving
 */
export class OneEuroFilter {
  private readonly position = new LowPass();
  private readonly speed = new LowPass();
  private lastValue: number | null = null;
  private lastTime = 0;
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly speedCutoff: number;

  constructor(minCutoff: number, beta: number, speedCutoff = 1) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.speedCutoff = speedCutoff;
  }

  filter(value: number, timeMs: number): number {
    if (this.lastValue === null) {
      this.lastValue = value;
      this.lastTime = timeMs;
      return this.position.filter(value, 1);
    }
    const dt = Math.max((timeMs - this.lastTime) / 1000, 1e-3);
    const rawSpeed = (value - this.lastValue) / dt;
    const smoothSpeed = this.speed.filter(rawSpeed, smoothingFactor(this.speedCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(smoothSpeed);
    this.lastValue = value;
    this.lastTime = timeMs;
    return this.position.filter(value, smoothingFactor(cutoff, dt));
  }

  reset(): void {
    this.position.reset();
    this.speed.reset();
    this.lastValue = null;
  }
}
