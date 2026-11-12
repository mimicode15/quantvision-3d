import { VisionError } from "./errors";

export interface CameraSize {
  width: number;
  height: number;
}

/** What the pipeline needs from a camera. CameraManager implements it; tests pass a fake. */
export interface CameraLike {
  /** Opens the camera, plays it in `video`, and resolves with the frame size. `onEnded` fires if the camera disappears. */
  start(video: HTMLVideoElement, onEnded?: () => void): Promise<CameraSize>;
  stop(): void;
}

const MESSAGES = {
  denied:
    "Camera access is blocked. Allow it in your browser's site settings, then try again. The sliders still work.",
  "not-found": "No camera was found on this device. The sliders still work.",
  "in-use": "The camera is busy or can't be opened. Close other apps using it and try again.",
  insecure: "Camera access needs a secure page (https or localhost).",
  unsupported: "This browser can't access a camera.",
  disconnected: "The camera was disconnected.",
  unknown: "Couldn't start the camera.",
} as const;

/** Maps a getUserMedia failure to a VisionError with a message a student can act on. */
export function classifyCameraError(error: unknown): VisionError {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  let kind: keyof typeof MESSAGES = "unknown";
  if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name)) {
    kind = "denied";
  } else if (["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"].includes(name)) {
    kind = "not-found";
  } else if (["NotReadableError", "TrackStartError", "AbortError"].includes(name)) {
    kind = "in-use";
  }
  return new VisionError(kind, MESSAGES[kind], { cause: error });
}

export class CameraManager implements CameraLike {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;

  async start(video: HTMLVideoElement, onEnded?: () => void): Promise<CameraSize> {
    if (!window.isSecureContext) throw new VisionError("insecure", MESSAGES.insecure);
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new VisionError("unsupported", MESSAGES.unsupported);
    }
    this.stop();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
    } catch (error) {
      throw classifyCameraError(error);
    }

    this.stream = stream;
    this.video = video;
    for (const track of stream.getVideoTracks()) {
      // stop() never fires "ended", so this only runs when the camera really goes away.
      track.addEventListener(
        "ended",
        () => {
          if (this.stream === stream) onEnded?.();
        },
        { once: true },
      );
    }

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    try {
      await video.play();
    } catch (error) {
      this.stop();
      throw new VisionError("unknown", MESSAGES.unknown, { cause: error });
    }

    const settings = stream.getVideoTracks()[0]?.getSettings() ?? {};
    return {
      width: video.videoWidth || settings.width || 640,
      height: video.videoHeight || settings.height || 480,
    };
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
  }
}
