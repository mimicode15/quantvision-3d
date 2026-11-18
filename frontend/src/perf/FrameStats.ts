/** Rolling window of frame times, so the overlay can show fps and the worst recent frame. */
export class FrameStats {
  private readonly times: number[] = [];

  constructor(
    private readonly size = 120,
    private readonly slowMs = 20,
  ) {}

  add(ms: number): void {
    this.times.push(ms);
    if (this.times.length > this.size) this.times.shift();
  }

  get count(): number {
    return this.times.length;
  }

  get avgMs(): number {
    if (!this.times.length) return 0;
    return this.times.reduce((sum, t) => sum + t, 0) / this.times.length;
  }

  get fps(): number {
    const avg = this.avgMs;
    return avg > 0 ? 1000 / avg : 0;
  }

  get worstMs(): number {
    return this.times.length ? Math.max(...this.times) : 0;
  }

  /** Share of recent frames slower than slowMs (0 to 1). */
  get slowShare(): number {
    if (!this.times.length) return 0;
    return this.times.filter((t) => t > this.slowMs).length / this.times.length;
  }

  reset(): void {
    this.times.length = 0;
  }
}
