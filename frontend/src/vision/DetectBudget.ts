/**
 * Hand detection runs on the main thread. If it gets slow, run it less often so the page
 * keeps drawing smoothly: detection may use about half of the time.
 */
export class DetectBudget {
  private ema = 0;

  constructor(
    private readonly freeMs = 16,
    private readonly maxIntervalMs = 100,
  ) {}

  record(ms: number): void {
    this.ema = this.ema === 0 ? ms : this.ema * 0.8 + ms * 0.2;
  }

  get averageMs(): number {
    return this.ema;
  }

  /** Smallest gap to leave between detections. 0 means run on every camera frame. */
  get intervalMs(): number {
    if (this.ema <= this.freeMs) return 0;
    return Math.min(this.ema * 2, this.maxIntervalMs);
  }

  reset(): void {
    this.ema = 0;
  }
}
