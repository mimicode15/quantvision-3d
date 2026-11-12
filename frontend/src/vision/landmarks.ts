/** One MediaPipe hand landmark. x and y are 0..1 across the video frame (origin top-left); z is relative depth. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export const LANDMARK_COUNT = 21;

/** MediaPipe's landmark indices. Day 5 uses THUMB_TIP and INDEX_TIP for the pinch gesture. */
export const HAND = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

/** The 21 bones of the hand skeleton, as pairs of landmark indices. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4], // thumb
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8], // index
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12], // middle
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16], // ring
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20], // pinky
  [0, 17], // outer edge of the palm
];

/** True when the array holds exactly 21 landmarks with finite coordinates. */
export function isValidHand(landmarks: readonly Landmark[] | undefined | null): boolean {
  if (!landmarks || landmarks.length !== LANDMARK_COUNT) return false;
  return landmarks.every(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
  );
}

/** Flip left-right (x -> 1 - x), the way a mirror shows you. */
export function mirrorX(landmarks: readonly Landmark[]): Landmark[] {
  return landmarks.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));
}

export function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Frames per second over a sliding time window. */
export class FpsMeter {
  private readonly stamps: number[] = [];
  private readonly windowMs: number;

  constructor(windowMs = 1000) {
    this.windowMs = windowMs;
  }

  tick(nowMs: number): void {
    this.stamps.push(nowMs);
    while (this.stamps.length > 2 && nowMs - (this.stamps[0] as number) > this.windowMs) {
      this.stamps.shift();
    }
  }

  get fps(): number {
    const n = this.stamps.length;
    if (n < 2) return 0;
    const span = (this.stamps[n - 1] as number) - (this.stamps[0] as number);
    return span > 0 ? ((n - 1) * 1000) / span : 0;
  }

  reset(): void {
    this.stamps.length = 0;
  }
}
