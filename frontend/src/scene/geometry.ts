import type { Vec3 } from "../math/quantum";
import { blochToWorld } from "./coords";

// All shapes here are described in Bloch coordinates (z up = |0>) as plain arrays.
// Only toWorldPositions / fillWorldPositions convert to the Three.js frame.

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

export const WIRE_SEGMENTS = 96;
export const WIRE_RING_COUNT = 11; // 5 parallels (incl. the equator) + 6 meridian circles
export const AXIS_EXTENT = 1.18;
export const LABEL_DISTANCE = 1.32;
export const WEDGE_RADIUS = 0.42;
export const WEDGE_SEGMENTS = 48;
export const HEAD_LENGTH = 0.16;
export const HEAD_RADIUS = 0.035;

/** A closed loop of points -> line-segment pairs (what LineSegments draws). */
export function loopToSegments(points: readonly Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < points.length; i++) {
    out.push(points[i], points[(i + 1) % points.length]);
  }
  return out;
}

/** Circle of latitude: height sin(lat), radius cos(lat). */
export function latitudeLoop(lat: number, segments = WIRE_SEGMENTS): Vec3[] {
  const z = Math.sin(lat);
  const radius = Math.cos(lat);
  return Array.from({ length: segments }, (_, i): Vec3 => {
    const a = (i / segments) * TAU;
    return [radius * Math.cos(a), radius * Math.sin(a), z];
  });
}

/** Great circle through both poles, in the vertical plane at the given azimuth. */
export function meridianLoop(azimuth: number, segments = WIRE_SEGMENTS): Vec3[] {
  const ux = Math.cos(azimuth);
  const uy = Math.sin(azimuth);
  return Array.from({ length: segments }, (_, i): Vec3 => {
    const t = (i / segments) * TAU;
    return [Math.cos(t) * ux, Math.cos(t) * uy, Math.sin(t)];
  });
}

/** Sparse armillary-sphere wireframe: 5 parallels and 6 meridian circles. */
export function sphereWireSegments(): Vec3[] {
  const loops: Vec3[][] = [];
  for (const lat of [-60, -30, 0, 30, 60]) loops.push(latitudeLoop(lat * DEG));
  for (let k = 0; k < 6; k++) loops.push(meridianLoop(k * 30 * DEG));
  return loops.flatMap(loopToSegments);
}

export function axisSegments(extent = AXIS_EXTENT): Vec3[] {
  return [
    [-extent, 0, 0],
    [extent, 0, 0],
    [0, -extent, 0],
    [0, extent, 0],
    [0, 0, -extent],
    [0, 0, extent],
  ];
}

/** Small perpendicular tick marks at +-0.5 and +-1 on every axis. */
export function tickSegments(half = 0.03): Vec3[] {
  const out: Vec3[] = [];
  for (const t of [-1, -0.5, 0.5, 1]) {
    out.push([t, 0, -half], [t, 0, half]);
    out.push([0, t, -half], [0, t, half]);
    out.push([-half, 0, t], [half, 0, t]);
  }
  return out;
}

/** Protractor ticks on the rim of the equatorial disc, every 30 degrees (longer every 90). */
export function phaseTickSegments(): Vec3[] {
  const out: Vec3[] = [];
  for (let k = 0; k < 12; k++) {
    const a = k * 30 * DEG;
    const inner = k % 3 === 0 ? 0.9 : 0.95;
    out.push([inner * Math.cos(a), inner * Math.sin(a), 0], [Math.cos(a), Math.sin(a), 0]);
  }
  return out;
}

/** Triangle-fan vertices for the phase wedge: the centre, then an arc from +X to angle phi. */
export function wedgeFan(phi: number, radius = WEDGE_RADIUS, segments = WEDGE_SEGMENTS): Vec3[] {
  const points: Vec3[] = [[0, 0, 0]];
  for (let i = 0; i <= segments; i++) {
    const a = (phi * i) / segments;
    points.push([radius * Math.cos(a), radius * Math.sin(a), 0]);
  }
  return points;
}

export function wedgeIndices(segments = WEDGE_SEGMENTS): number[] {
  const out: number[] = [];
  for (let i = 1; i <= segments; i++) out.push(0, i, i + 1);
  return out;
}

/** Shaft and cone lengths for a needle of the given total length (the head shrinks if short). */
export function needleDimensions(length: number): {
  shaft: number;
  head: number;
  headRadius: number;
} {
  const total = Math.max(length, 0);
  const head = Math.min(HEAD_LENGTH, total);
  return { shaft: total - head, head, headRadius: HEAD_RADIUS * (head / HEAD_LENGTH) };
}

/** The tip of the needle and its footprint straight below it on the equatorial plane. */
export function shadowPoints(v: Vec3): { tip: Vec3; foot: Vec3 } {
  return { tip: v, foot: [v[0], v[1], 0] };
}

/** Write Bloch-frame points into a Float32Array in the Three.js world frame. */
export function fillWorldPositions(target: Float32Array, points: readonly Vec3[], lift = 0): void {
  points.forEach((p, i) => {
    const [x, y, z] = blochToWorld(p);
    target[3 * i] = x;
    target[3 * i + 1] = y + lift;
    target[3 * i + 2] = z;
  });
}

export function toWorldPositions(points: readonly Vec3[], lift = 0): Float32Array {
  const out = new Float32Array(points.length * 3);
  fillWorldPositions(out, points, lift);
  return out;
}
