import { describe, expect, it } from "vitest";
import type { CameraLike } from "./CameraManager";
import type { TrackerLike } from "./HandTracker";
import type { HandFrame } from "./parse";
import { VisionPipeline, type FrameScheduler } from "./VisionPipeline";

class ManualScheduler implements FrameScheduler {
  private next = 1;
  private callback: ((nowMs: number) => void) | null = null;
  request(callback: (nowMs: number) => void): number {
    this.callback = callback;
    return this.next++;
  }
  cancel(): void {
    this.callback = null;
  }
  frame(nowMs: number): void {
    const cb = this.callback;
    this.callback = null;
    cb?.(nowMs);
  }
}

const camera: CameraLike = {
  start: async () => ({ width: 640, height: 480 }),
  stop: () => {},
};

/** A tracker whose detect() "takes" costMs on the fake clock. */
function setup(costMs: number) {
  let clock = 0;
  let calls = 0;
  const tracker: TrackerLike = {
    detect: (_video, nowMs): HandFrame => {
      calls++;
      clock += costMs;
      return { timestamp: nowMs, hand: null };
    },
    dispose: () => {},
  };
  const scheduler = new ManualScheduler();
  const pipeline = new VisionPipeline({
    video: {} as HTMLVideoElement,
    camera,
    createTracker: async () => tracker,
    scheduler,
    now: () => clock,
  });
  return { pipeline, scheduler, calls: () => calls };
}

describe("VisionPipeline detection budget", () => {
  it("detects on every frame while detection is cheap", async () => {
    const { pipeline, scheduler, calls } = setup(5);
    await pipeline.start();
    for (let i = 1; i <= 30; i++) scheduler.frame(i * 33);
    expect(calls()).toBe(30);
    expect(pipeline.detectMs).toBe(5);
  });

  it("skips frames once detection is slow, and keeps going", async () => {
    const { pipeline, scheduler, calls } = setup(40);
    await pipeline.start();
    for (let i = 1; i <= 60; i++) scheduler.frame(i * 33);
    expect(calls()).toBeLessThan(40);
    expect(calls()).toBeGreaterThan(15);
    expect(Math.abs(pipeline.detectMs - 40)).toBeLessThan(1);
  });

  it("starts fresh after stop and start", async () => {
    const { pipeline, scheduler } = setup(40);
    await pipeline.start();
    for (let i = 1; i <= 20; i++) scheduler.frame(i * 33);
    pipeline.stop();
    await pipeline.start();
    expect(pipeline.detectMs).toBe(0);
  });
});
