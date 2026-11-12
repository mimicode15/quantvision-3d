import { HAND, distance, type Landmark } from "./landmarks";
import type { HandResult } from "./parse";

/** Wrap an angle into (-π, π]. */
export const wrapPi = (angle: number): number => {
  const wrapped = ((((angle + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
};

/** Wrap an angle into [0, 2π). */
export const wrap2Pi = (angle: number): number =>
  ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

/** [MCP, PIP, DIP, TIP] landmark indices for the four long fingers. */
export const FINGERS = {
  index: [HAND.INDEX_MCP, HAND.INDEX_PIP, HAND.INDEX_DIP, HAND.INDEX_TIP],
  middle: [HAND.MIDDLE_MCP, HAND.MIDDLE_PIP, HAND.MIDDLE_DIP, HAND.MIDDLE_TIP],
  ring: [HAND.RING_MCP, HAND.RING_PIP, HAND.RING_DIP, HAND.RING_TIP],
  pinky: [HAND.PINKY_MCP, HAND.PINKY_PIP, HAND.PINKY_DIP, HAND.PINKY_TIP],
} as const;

type Vec = readonly [number, number, number];

const sub = (a: Landmark, b: Landmark): Vec => [a.x - b.x, a.y - b.y, a.z - b.z];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec): number => Math.hypot(a[0], a[1], a[2]);
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const cosBetween = (a: Vec, b: Vec): number => {
  const denom = norm(a) * norm(b);
  return denom > 0 ? dot(a, b) / denom : 0;
};

/** Wrist to middle-finger knuckle: a size yardstick that doesn't change when you pinch or curl. */
export function handScale(points: readonly Landmark[]): number {
  return distance(points[HAND.WRIST] as Landmark, points[HAND.MIDDLE_MCP] as Landmark);
}

/**
 * Thumb-tip to index-tip distance divided by hand size. About 1 with the hand open and under
 * 0.25 when pinched. Uses world landmarks so it doesn't depend on how far you are from the camera.
 */
export function pinchRatio(world: readonly Landmark[]): number {
  const scale = handScale(world);
  if (scale <= 0) return Number.POSITIVE_INFINITY;
  return distance(world[HAND.THUMB_TIP] as Landmark, world[HAND.INDEX_TIP] as Landmark) / scale;
}

/** A finger is extended when both its joints are close to straight (cosine of the bend >= minCos). */
export function isFingerExtended(
  points: readonly Landmark[],
  finger: readonly [number, number, number, number],
  minCos: number,
): boolean {
  const [mcp, pip, dip, tip] = finger.map((i) => points[i] as Landmark) as [
    Landmark,
    Landmark,
    Landmark,
    Landmark,
  ];
  const lower = cosBetween(sub(pip, mcp), sub(dip, pip));
  const upper = cosBetween(sub(dip, pip), sub(tip, dip));
  return lower >= minCos && upper >= minCos;
}

/**
 * How squarely the palm faces the camera (or faces directly away), 0..1.
 * 1 = palm plane parallel to the image, 0 = seen edge-on.
 */
export function palmFacing(world: readonly Landmark[]): number {
  const wrist = world[HAND.WRIST] as Landmark;
  const normal = cross(
    sub(world[HAND.INDEX_MCP] as Landmark, wrist),
    sub(world[HAND.PINKY_MCP] as Landmark, wrist),
  );
  const length = norm(normal);
  return length > 0 ? Math.abs(normal[2]) / length : 0;
}

export interface PalmPoseThresholds {
  /** Minimum cosine of each finger joint's bend to count as straight. */
  fingerStraightCos: number;
  /** Minimum palmFacing() to count as "flat toward the camera". */
  palmFacingMin: number;
}

/** Four fingers straight and the palm squarely toward the camera. (Pinch is excluded by the caller.) */
export function isOpenPalm(world: readonly Landmark[], t: PalmPoseThresholds): boolean {
  return (
    palmFacing(world) >= t.palmFacingMin &&
    Object.values(FINGERS).every((finger) => isFingerExtended(world, finger, t.fingerStraightCos))
  );
}

/** Vertical position of the palm centre in the frame, 0 (top) to 1 (bottom). Steady under pinching. */
export function palmCenterY(image: readonly Landmark[]): number {
  const ids: number[] = [
    HAND.WRIST,
    HAND.INDEX_MCP,
    HAND.MIDDLE_MCP,
    HAND.RING_MCP,
    HAND.PINKY_MCP,
  ];
  return ids.reduce((sum, i) => sum + (image[i] as Landmark).y, 0) / ids.length;
}

/**
 * Wrist roll as the user sees it in the mirrored preview: 0 = fingers straight up,
 * positive = tilted to the user's right (clockwise). `aspect` is video width / height, so the
 * angle isn't distorted by the frame's non-square coordinates.
 */
export function wristTilt(image: readonly Landmark[], aspect: number): number {
  const wrist = image[HAND.WRIST] as Landmark;
  const knuckle = image[HAND.MIDDLE_MCP] as Landmark;
  // Raw camera x is the mirror of what the user sees, so flip dx.
  const dx = (knuckle.x - wrist.x) * aspect;
  const dy = knuckle.y - wrist.y;
  return Math.atan2(-dx, -dy);
}

export interface HandFeatures {
  pinchRatio: number;
  palmY: number;
  tilt: number;
}

export function measureHand(hand: HandResult, aspect: number): HandFeatures {
  return {
    pinchRatio: pinchRatio(hand.worldLandmarks),
    palmY: palmCenterY(hand.landmarks),
    tilt: wristTilt(hand.landmarks, aspect),
  };
}
