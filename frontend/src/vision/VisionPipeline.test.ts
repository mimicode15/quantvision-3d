import { describe, expect, it } from "vitest";
import type { CameraLike, CameraSize } from "./CameraManager";
import type { TrackerLike } from "./HandTracker";
import { VisionError } from "./errors";
import type { HandFrame } from "./parse";
import { VisionPipeline, type FrameScheduler, type VisionStatus } from "./VisionPipeline";

/** Hand-cranked scheduler: nothing runs until the test calls frame(). */
class ManualScheduler implements FrameScheduler {
  private next = 1;
  readonly pending = new Map<number, (nowMs: number) => void>();
  request(callback: (nowMs: number) => void): number {
    const id = this.next++;
    this.pending.set(id, callback);
    return id;
  }
  cancel(id: number): void {
    this.pending.delete(id);
  }
  frame(nowMs: number): void {
    const [id, callback] = [...this.pending.entries()][0] ?? [];
    if (id === undefined || !callback) return;
    this.pending.delete(id);
    callback(nowMs);
  }
}

class FakeCamera implements CameraLike {
  starts = 0;
  stops = 0;
  failWith: Error | null = null;
  gate: Promise<void> | null = null;
  onEnded: (() => void) | undefined;
  async start(_video: HTMLVideoElement, onEnded?: () => void): Promise<CameraSize> {
    this.starts++;
    this.onEnded = onEnded;
    if (this.gate) await this.gate;
    if (this.failWith) throw this.failWith;
    return { width: 640, height: 480 };
  }
  stop(): void {
    this.stops++;
  }
}

class FakeTracker implements TrackerLike {
  disposed = 0;
  calls = 0;
  stale = false;
  throwOnDetect = false;
  detect(_video: HTMLVideoElement, nowMs: number): HandFrame | null {
    this.calls++;
    if (this.throwOnDetect) throw new Error("wasm crashed");
    return this.stale ? null : { timestamp: nowMs, hand: null };
  }
  dispose(): void {
    this.disposed++;
  }
}

const video = {} as HTMLVideoElement;

const setup = () => {
  const camera = new FakeCamera();
  const tracker = new FakeTracker();
  const scheduler = new ManualScheduler();
  const pipeline = new VisionPipeline({
    video,
    camera,
    createTracker: async () => tracker,
    scheduler,
  });
  const states: string[] = [];
  pipeline.onStatus((s: VisionStatus) => states.push(s.state));
  return { camera, tracker, scheduler, pipeline, states };
};

describe("VisionPipeline lifecycle", () => {
  it("walks idle -> requesting -> loading -> running", async () => {
    const { pipeline, states } = setup();
    expect(pipeline.status.state).toBe("idle");
    await pipeline.start();
    expect(states).toEqual(["requesting", "loading", "running"]);
    expect(pipeline.status).toEqual({ state: "running", size: { width: 640, height: 480 } });
  });

  it("ignores start() while already running", async () => {
    const { pipeline, camera } = setup();
    await pipeline.start();
    await pipeline.start();
    expect(camera.starts).toBe(1);
  });

  it("stop() releases the camera and tracker and returns to idle", async () => {
    const { pipeline, camera, tracker, scheduler, states } = setup();
    await pipeline.start();
    pipeline.stop();
    expect(pipeline.status.state).toBe("idle");
    expect(camera.stops).toBe(1);
    expect(tracker.disposed).toBe(1);
    expect(scheduler.pending.size).toBe(0);
    expect(states[states.length - 1]).toBe("idle");
  });

  it("can start again after stopping", async () => {
    const { pipeline, camera } = setup();
    await pipeline.start();
    pipeline.stop();
    await pipeline.start();
    expect(camera.starts).toBe(2);
    expect(pipeline.status.state).toBe("running");
  });
});

describe("VisionPipeline errors", () => {
  it("surfaces a camera failure with its kind and message, and cleans up", async () => {
    const { pipeline, camera } = setup();
    camera.failWith = new VisionError("denied", "Camera access is blocked.");
    await pipeline.start();
    expect(pipeline.status).toEqual({
      state: "error",
      kind: "denied",
      message: "Camera access is blocked.",
    });
    expect(camera.stops).toBe(1);
  });

  it("turns unexpected exceptions into a generic error", async () => {
    const { pipeline, camera } = setup();
    camera.failWith = new Error("???");
    await pipeline.start();
    expect(pipeline.status.state).toBe("error");
    expect((pipeline.status as { kind: string }).kind).toBe("unknown");
  });

  it("allows retrying after an error", async () => {
    const { pipeline, camera } = setup();
    camera.failWith = new VisionError("in-use", "busy");
    await pipeline.start();
    camera.failWith = null;
    await pipeline.start();
    expect(pipeline.status.state).toBe("running");
  });

  it("reports the camera disappearing while running", async () => {
    const { pipeline, camera, tracker } = setup();
    await pipeline.start();
    camera.onEnded?.();
    expect((pipeline.status as { kind: string }).kind).toBe("disconnected");
    expect(tracker.disposed).toBe(1);
  });

  it("reports a tracker crash mid-run and stops scheduling frames", async () => {
    const { pipeline, tracker, scheduler } = setup();
    await pipeline.start();
    tracker.throwOnDetect = true;
    scheduler.frame(100);
    expect((pipeline.status as { kind: string }).kind).toBe("tracker-failed");
    expect(scheduler.pending.size).toBe(0);
  });

  it("surfaces a tracker that fails to load", async () => {
    const camera = new FakeCamera();
    const pipeline = new VisionPipeline({
      video,
      camera,
      createTracker: async () => {
        throw new VisionError("model-missing", "files missing");
      },
      scheduler: new ManualScheduler(),
    });
    await pipeline.start();
    expect((pipeline.status as { kind: string }).kind).toBe("model-missing");
    expect(camera.stops).toBe(1);
  });
});

describe("VisionPipeline frames", () => {
  it("delivers each fresh frame with a running fps estimate", async () => {
    const { pipeline, scheduler } = setup();
    const seen: number[] = [];
    let lastFps = 0;
    pipeline.onFrame((frame, fps) => {
      seen.push(frame.timestamp);
      lastFps = fps;
    });
    await pipeline.start();
    for (let i = 0; i < 31; i++) scheduler.frame(i * (1000 / 30));
    expect(seen).toHaveLength(31);
    expect(lastFps).toBeCloseTo(30, 6);
  });

  it("skips stale frames but keeps polling", async () => {
    const { pipeline, tracker, scheduler } = setup();
    const seen: number[] = [];
    pipeline.onFrame((frame) => seen.push(frame.timestamp));
    await pipeline.start();
    tracker.stale = true;
    scheduler.frame(10);
    scheduler.frame(20);
    expect(seen).toHaveLength(0);
    expect(tracker.calls).toBe(2);
    expect(scheduler.pending.size).toBe(1);
  });

  it("stops delivering after unsubscribe", async () => {
    const { pipeline, scheduler } = setup();
    let count = 0;
    const off = pipeline.onFrame(() => count++);
    await pipeline.start();
    scheduler.frame(1);
    off();
    scheduler.frame(2);
    expect(count).toBe(1);
  });
});

describe("VisionPipeline cancellation", () => {
  it("stop() during the camera prompt discards the stream that arrives afterwards", async () => {
    const { pipeline, camera, tracker } = setup();
    let release: () => void = () => {};
    camera.gate = new Promise<void>((resolve) => (release = resolve));
    const starting = pipeline.start();
    expect(pipeline.status.state).toBe("requesting");
    pipeline.stop();
    release();
    await starting;
    expect(pipeline.status.state).toBe("idle");
    expect(camera.stops).toBe(2); // once by stop(), once for the late stream
    expect(tracker.calls).toBe(0);
  });

  it("stop() while the model loads disposes the tracker that finishes afterwards", async () => {
    const camera = new FakeCamera();
    const tracker = new FakeTracker();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const pipeline = new VisionPipeline({
      video,
      camera,
      createTracker: async () => {
        await gate;
        return tracker;
      },
      scheduler: new ManualScheduler(),
    });
    const starting = pipeline.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(pipeline.status.state).toBe("loading");
    pipeline.stop();
    release();
    await starting;
    expect(pipeline.status.state).toBe("idle");
    expect(tracker.disposed).toBe(1);
  });
});
