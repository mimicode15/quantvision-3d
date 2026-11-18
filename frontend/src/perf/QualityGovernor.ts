/**
 * Lowers the canvas resolution when frames stay slow. It only ever steps down, so it can't
 * flip back and forth. Feed it one frame time at a time while the scene is busy.
 */
export class QualityGovernor {
  private readonly tiers: number[];
  private index = 0;
  private slowSince: number | null = null;
  private cooldownUntil = 0;

  constructor(
    maxPixelRatio: number,
    private readonly slowFps = 40,
    private readonly slowForMs = 2000,
    private readonly cooldownMs = 3000,
  ) {
    const wanted = [2, 1.5, 1, 0.75].filter((r) => r < maxPixelRatio);
    this.tiers = [maxPixelRatio, ...wanted];
  }

  get pixelRatio(): number {
    return this.tiers[this.index] as number;
  }

  /** Returns the new pixel ratio when it changes, otherwise null. */
  update(nowMs: number, fps: number): number | null {
    if (nowMs < this.cooldownUntil) return null;
    if (fps >= this.slowFps) {
      this.slowSince = null;
      return null;
    }
    this.slowSince ??= nowMs;
    if (nowMs - this.slowSince < this.slowForMs) return null;
    this.slowSince = null;
    if (this.index >= this.tiers.length - 1) return null;
    this.index++;
    this.cooldownUntil = nowMs + this.cooldownMs;
    return this.pixelRatio;
  }

  /** Call on frames where nothing needed drawing, so a quiet spell isn't counted as slow. */
  idle(): void {
    this.slowSince = null;
  }
}
