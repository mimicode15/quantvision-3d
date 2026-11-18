/** Keeps the error toast from spamming: a few at most, spaced out. */
export class ErrorThrottle {
  private shown = 0;
  private lastAt = -Infinity;

  constructor(
    private readonly maxShown = 3,
    private readonly gapMs = 5000,
  ) {}

  allow(nowMs: number): boolean {
    if (this.shown >= this.maxShown || nowMs - this.lastAt < this.gapMs) return false;
    this.shown++;
    this.lastAt = nowMs;
    return true;
  }
}

// Browsers report these when nothing is actually broken.
const HARMLESS = [/ResizeObserver loop/i, /^Script error\.?$/i];

export const isHarmless = (message: string): boolean => HARMLESS.some((re) => re.test(message));
