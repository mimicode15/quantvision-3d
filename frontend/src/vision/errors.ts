/** Everything that can stop the camera or the hand tracker from starting, in plain categories. */
export type VisionErrorKind =
  | "unsupported" // browser has no camera API
  | "insecure" // page isn't https or localhost
  | "denied" // user (or policy) blocked the camera
  | "not-found" // no camera on this device
  | "in-use" // camera busy or can't be opened
  | "disconnected" // camera vanished while running
  | "model-missing" // hand model / wasm files weren't fetched
  | "tracker-failed" // MediaPipe couldn't start or crashed
  | "unknown";

export class VisionError extends Error {
  readonly kind: VisionErrorKind;

  constructor(kind: VisionErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "VisionError";
    this.kind = kind;
  }
}
