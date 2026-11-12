import { HAND, HAND_CONNECTIONS } from "../vision/landmarks";
import type { GestureOutput } from "../vision/GestureMapper";
import type { HandFrame } from "../vision/parse";
import type { VisionStatus } from "../vision/VisionPipeline";

export interface CameraPanelHandlers {
  onToggle: () => void;
}

const TEAL = "#a8dadc";
const VIOLET = "#7c3aed";
const WHITE = "#ffffff";

const STATUS_TEXT = {
  idle: "Camera off. Sliders work without it.",
  requesting: "Waiting for camera permission…",
  loading: "Loading hand model…",
  running: "Show one hand to the camera.",
} as const;

const GESTURE_TEXT: Record<string, string> = {
  off: "",
  none: "No hand in view",
  tracking: "Pinch to steer. Hold an open palm to measure.",
  steering: "Steering: move up/down for θ, tilt for φ",
  palm: "Hold still to measure…",
};

/**
 * Compact corner card: mirrored webcam preview with the hand skeleton drawn over it.
 * The video and canvas share one CSS mirror, so landmarks are drawn in raw (un-mirrored) coordinates.
 */
export class CameraPanel {
  readonly element: HTMLElement;
  readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly frame: HTMLElement;
  private readonly dot: HTMLElement;
  private readonly status: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly mode: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly pinch: HTMLElement;
  private lastStatsAt = 0;
  private lastPinchAt = 0;
  private lastMode = "";
  private canvasW = 0;
  private canvasH = 0;

  constructor(handlers: CameraPanelHandlers) {
    this.element = document.createElement("section");
    this.element.className = "qv-cam";
    this.element.setAttribute("aria-label", "Hand tracking camera");
    this.element.dataset.state = "idle";
    this.element.innerHTML = `
      <div class="qv-cam__head">
        <h2>Camera</h2>
        <span class="qv-cam__dot" aria-hidden="true"></span>
      </div>
      <div class="qv-cam__frame">
        <div class="qv-cam__mirror">
          <video class="qv-cam__video" playsinline muted></video>
          <canvas class="qv-cam__overlay" aria-hidden="true"></canvas>
        </div>
        <p class="qv-cam__idle">Camera off</p>
      </div>
      <p class="qv-cam__status" role="status"></p>
      <p class="qv-cam__stats" aria-hidden="true"></p>
      <div class="qv-cam__gesture" aria-hidden="true">
        <p class="qv-cam__mode"></p>
        <div class="qv-cam__bar"><span></span></div>
        <p class="qv-cam__pinch"></p>
      </div>
      <button type="button" class="qv-btn qv-btn--primary qv-cam__button" data-action="camera-toggle"></button>
      <p class="qv-cam__privacy">Video never leaves your browser.</p>`;

    const find = <T extends HTMLElement>(selector: string): T => {
      const node = this.element.querySelector<T>(selector);
      if (!node) throw new Error(`camera panel is missing ${selector}`);
      return node;
    };
    this.video = find<HTMLVideoElement>(".qv-cam__video");
    this.canvas = find<HTMLCanvasElement>(".qv-cam__overlay");
    this.frame = find(".qv-cam__frame");
    this.dot = find(".qv-cam__dot");
    this.status = find(".qv-cam__status");
    this.stats = find(".qv-cam__stats");
    this.button = find<HTMLButtonElement>(".qv-cam__button");
    this.mode = find(".qv-cam__mode");
    this.bar = find(".qv-cam__bar > span");
    this.pinch = find(".qv-cam__pinch");
    this.button.addEventListener("click", handlers.onToggle);
    this.setStatus({ state: "idle" });
  }

  setStatus(status: VisionStatus): void {
    this.element.dataset.state = status.state;
    this.dot.dataset.state = status.state;
    this.stats.textContent = "";
    this.showGesture(null);
    this.clearOverlay();

    switch (status.state) {
      case "running":
        this.frame.style.aspectRatio = `${status.size.width} / ${status.size.height}`;
        this.status.textContent = STATUS_TEXT.running;
        this.button.textContent = "Stop camera";
        this.button.disabled = false;
        break;
      case "error":
        this.status.textContent = status.message;
        this.button.textContent = "Try again";
        this.button.disabled = false;
        break;
      case "idle":
        this.status.textContent = STATUS_TEXT.idle;
        this.button.textContent = "Enable camera";
        this.button.disabled = false;
        break;
      default:
        this.status.textContent = STATUS_TEXT[status.state];
        this.button.textContent = "Starting…";
        this.button.disabled = true;
    }
  }

  /** Draws the latest frame's skeleton and refreshes the stats line a few times a second. */
  showFrame(frame: HandFrame, fps: number): void {
    this.draw(frame);
    if (frame.timestamp - this.lastStatsAt >= 250) {
      this.lastStatsAt = frame.timestamp;
      this.stats.textContent = `${frame.hand ? "1 hand" : "no hand"} · ${Math.round(fps)} fps`;
    }
  }

  /** Shows what the gesture mapper currently sees. Pass null when the camera is off. */
  showGesture(output: GestureOutput | null): void {
    const mode = output?.mode ?? "off";
    if (mode !== this.lastMode) {
      this.lastMode = mode;
      this.element.dataset.gesture = mode;
      this.mode.textContent = GESTURE_TEXT[mode];
    }
    const progress = output?.palmProgress ?? 0;
    this.bar.style.width = `${Math.round(progress * 100)}%`;
    if (!output || output.pinchRatio === null) {
      this.pinch.textContent = "";
    } else if (performance.now() - this.lastPinchAt >= 200) {
      this.lastPinchAt = performance.now();
      this.pinch.textContent = `pinch ${output.pinchRatio.toFixed(2)}`;
    }
  }

  private clearOverlay(): void {
    this.canvas.getContext("2d")?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private draw(frame: HandFrame): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (width !== this.canvasW || height !== this.canvasH) {
      this.canvasW = width;
      this.canvasH = height;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!frame.hand) return;

    const pts = frame.hand.landmarks;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = TEAL;
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      const p = pts[a];
      const q = pts[b];
      if (!p || !q) continue;
      ctx.moveTo(p.x * width, p.y * height);
      ctx.lineTo(q.x * width, q.y * height);
    }
    ctx.stroke();

    const tips: number[] = [HAND.THUMB_TIP, HAND.INDEX_TIP];
    pts.forEach((p, i) => {
      const isTip = tips.includes(i);
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, isTip ? 4.5 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = VIOLET;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    });
  }
}
