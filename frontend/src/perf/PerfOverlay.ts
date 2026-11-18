import { make } from "../dom";
import type { FrameStats } from "./FrameStats";

export interface PerfSource {
  render?: FrameStats;
  pixelRatio?: number;
  tracker?: { fps: number; detectMs: number };
}

/** Small readout in the corner for profiling. Only shown with ?perf (or Shift+P). */
export class PerfOverlay {
  readonly element = make("aside", "qv-perf");
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly read: () => PerfSource) {
    this.element.setAttribute("aria-hidden", "true");
    this.element.hidden = true;
  }

  get visible(): boolean {
    return !this.element.hidden;
  }

  show(): void {
    this.element.hidden = false;
    this.refresh();
    this.timer ??= setInterval(() => this.refresh(), 250);
  }

  hide(): void {
    this.element.hidden = true;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  dispose(): void {
    this.hide();
    this.element.remove();
  }

  private refresh(): void {
    const { render, pixelRatio, tracker } = this.read();
    const lines: string[] = [];
    if (render && render.count > 0) {
      lines.push(
        `draw ${render.fps.toFixed(0)} fps · ${render.avgMs.toFixed(1)} ms · worst ${render.worstMs.toFixed(0)} ms`,
      );
    } else {
      lines.push("draw: no data");
    }
    if (pixelRatio !== undefined) lines.push(`pixel ratio ${pixelRatio}`);
    lines.push(
      tracker
        ? `hand ${tracker.fps.toFixed(0)} fps · detect ${tracker.detectMs.toFixed(1)} ms`
        : "hand: camera off",
    );
    this.element.textContent = lines.join("\n");
  }
}
