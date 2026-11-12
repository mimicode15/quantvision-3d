import { VisionError, type VisionErrorKind } from "./errors";
import type { CameraLike, CameraSize } from "./CameraManager";
import type { TrackerLike } from "./HandTracker";
import { FpsMeter } from "./landmarks";
import type { HandFrame } from "./parse";

export type VisionStatus =
  | { state: "idle" }
  | { state: "requesting" } // waiting for camera permission
  | { state: "loading" } // loading the hand model
  | { state: "running"; size: CameraSize }
  | { state: "error"; kind: VisionErrorKind; message: string };

/** Calls back once per new video frame. Injected so tests don't need a browser. */
export interface FrameScheduler {
  request(callback: (nowMs: number) => void): number;
  cancel(handle: number): void;
}

interface VideoWithFrameCallback {
  requestVideoFrameCallback?: (callback: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
}

/** Prefers requestVideoFrameCallback (one call per camera frame); falls back to requestAnimationFrame. */
export function createFrameScheduler(video: HTMLVideoElement): FrameScheduler {
  const v = video as unknown as VideoWithFrameCallback;
  if (v.requestVideoFrameCallback && v.cancelVideoFrameCallback) {
    const request = v.requestVideoFrameCallback.bind(v);
    const cancel = v.cancelVideoFrameCallback.bind(v);
    return { request: (cb) => request((now) => cb(now)), cancel };
  }
  return {
    request: (cb) => requestAnimationFrame(cb),
    cancel: (handle) => cancelAnimationFrame(handle),
  };
}

export interface PipelineDeps {
  video: HTMLVideoElement;
  camera: CameraLike;
  createTracker: () => Promise<TrackerLike>;
  scheduler?: FrameScheduler;
}

type StatusListener = (status: VisionStatus) => void;
type FrameListener = (frame: HandFrame, fps: number) => void;

/**
 * Camera -> hand tracker -> listeners. One instance owns the whole lifecycle:
 * idle -> requesting -> loading -> running, or error. Safe to stop() at any point, even mid-start.
 */
export class VisionPipeline {
  private current: VisionStatus = { state: "idle" };
  private run = 0; // bumped on every start/stop so stale async work can tell it was cancelled
  private tracker: TrackerLike | null = null;
  private handle: number | null = null;
  private readonly fpsMeter = new FpsMeter();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly frameListeners = new Set<FrameListener>();
  private readonly deps: PipelineDeps;
  private scheduler: FrameScheduler | null;

  constructor(deps: PipelineDeps) {
    this.deps = deps;
    this.scheduler = deps.scheduler ?? null;
  }

  get status(): VisionStatus {
    return this.current;
  }

  get fps(): number {
    return this.fpsMeter.fps;
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Subscribe to every processed frame (including frames with no hand). Day 5's gesture mapper plugs in here. */
  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.current.state !== "idle" && this.current.state !== "error") return;
    const run = ++this.run;
    this.set({ state: "requesting" });
    try {
      const size = await this.deps.camera.start(this.deps.video, () =>
        this.fail(run, new VisionError("disconnected", "The camera was disconnected.")),
      );
      if (run !== this.run) {
        this.deps.camera.stop(); // stop() ran while we were waiting; the stream arrived afterwards
        return;
      }
      this.set({ state: "loading" });
      const tracker = await this.deps.createTracker();
      if (run !== this.run) {
        tracker.dispose();
        return;
      }
      this.tracker = tracker;
      this.fpsMeter.reset();
      this.set({ state: "running", size });
      this.scheduler ??= createFrameScheduler(this.deps.video);
      this.schedule(run);
    } catch (error) {
      this.fail(run, error);
    }
  }

  stop(): void {
    this.run++;
    this.teardown();
    this.set({ state: "idle" });
  }

  private schedule(run: number): void {
    const scheduler = this.scheduler;
    if (!scheduler) return;
    this.handle = scheduler.request((nowMs) => {
      this.handle = null;
      const tracker = this.tracker;
      if (run !== this.run || !tracker) return;
      try {
        const frame = tracker.detect(this.deps.video, nowMs);
        if (frame) {
          this.fpsMeter.tick(nowMs);
          for (const listener of this.frameListeners) listener(frame, this.fpsMeter.fps);
        }
      } catch (error) {
        this.fail(
          run,
          new VisionError("tracker-failed", "Hand tracking stopped unexpectedly.", {
            cause: error,
          }),
        );
        return;
      }
      this.schedule(run);
    });
  }

  private fail(run: number, error: unknown): void {
    if (run !== this.run) return;
    this.run++;
    this.teardown();
    const known = error instanceof VisionError;
    this.set({
      state: "error",
      kind: known ? error.kind : "unknown",
      message: known ? error.message : "Something went wrong starting hand tracking.",
    });
  }

  private teardown(): void {
    if (this.handle !== null) this.scheduler?.cancel(this.handle);
    this.handle = null;
    this.tracker?.dispose();
    this.tracker = null;
    this.deps.camera.stop();
  }

  private set(status: VisionStatus): void {
    this.current = status;
    for (const listener of this.statusListeners) listener(status);
  }
}
