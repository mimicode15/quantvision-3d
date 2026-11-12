import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { VisionError } from "./errors";
import { parseHandResult, type HandFrame } from "./parse";

/** What the pipeline needs from a tracker. HandTracker implements it; tests pass a fake. */
export interface TrackerLike {
  /** Returns null when the video hasn't produced a new frame since the last call. */
  detect(video: HTMLVideoElement, nowMs: number): HandFrame | null;
  dispose(): void;
}

export interface HandTrackerOptions {
  /** Folder holding MediaPipe's wasm files. Default: <base>/mediapipe/wasm */
  wasmBase?: string;
  /** The hand_landmarker.task model. Default: <base>/models/hand_landmarker.task */
  modelUrl?: string;
}

const HAVE_CURRENT_DATA = 2;
const SETUP_HINT = "Run `npm run setup-vision` in the frontend folder, then reload.";

/**
 * Vite serves index.html for any missing file, so a missing model comes back as a 200 with HTML.
 * Check the content type as well as the status.
 */
export async function checkAsset(url: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  let response: Response;
  try {
    response = await fetchImpl(url, { method: "HEAD" });
  } catch (error) {
    throw new VisionError("tracker-failed", "Couldn't load the hand tracking model.", {
      cause: error,
    });
  }
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || type.includes("text/html")) {
    throw new VisionError("model-missing", `Hand tracking files are missing. ${SETUP_HINT}`);
  }
}

export class HandTracker implements TrackerLike {
  private lastVideoTime = -1;
  private lastTimestamp = 0;
  private readonly landmarker: HandLandmarker;

  private constructor(landmarker: HandLandmarker) {
    this.landmarker = landmarker;
  }

  /** Loads MediaPipe lazily (it's a large bundle) and builds a single-hand tracker. */
  static async create(options: HandTrackerOptions = {}): Promise<HandTracker> {
    const base = import.meta.env.BASE_URL;
    const wasmBase = options.wasmBase ?? `${base}mediapipe/wasm`;
    const modelUrl = options.modelUrl ?? `${base}models/hand_landmarker.task`;

    await checkAsset(modelUrl);

    let landmarker: HandLandmarker;
    try {
      const { FilesetResolver, HandLandmarker: Landmarker } =
        await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(wasmBase);
      const build = (delegate: "GPU" | "CPU") =>
        Landmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelUrl, delegate },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        landmarker = await build("GPU");
      } catch {
        landmarker = await build("CPU"); // some browsers/GPUs can't run the GPU delegate
      }
    } catch (error) {
      throw new VisionError("tracker-failed", "Hand tracking couldn't start in this browser.", {
        cause: error,
      });
    }
    return new HandTracker(landmarker);
  }

  detect(video: HTMLVideoElement, nowMs: number): HandFrame | null {
    if (video.readyState < HAVE_CURRENT_DATA) return null;
    if (video.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = video.currentTime;
    // MediaPipe requires strictly increasing timestamps.
    const timestamp = Math.max(nowMs, this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;
    return parseHandResult(this.landmarker.detectForVideo(video, timestamp), timestamp);
  }

  dispose(): void {
    this.landmarker.close();
  }
}
