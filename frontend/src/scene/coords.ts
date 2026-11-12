import type { Vec3 } from "../math/quantum";

/**
 * Bloch frame -> Three.js world frame.
 * Bloch +Z (|0>) is world +Y (up) and Bloch +Y is world -Z. The map [x, z, -y] is a proper
 * rotation (determinant +1), so left/right handedness is preserved.
 */
// `0 - n` rather than `-n` so that 0 never turns into -0.
export const blochToWorld = (v: Vec3): Vec3 => [v[0], v[2], 0 - v[1]];
export const worldToBloch = (v: Vec3): Vec3 => [v[0], 0 - v[2], v[1]];

export interface Spherical {
  r: number;
  theta: number; // polar angle from +Z, 0..pi
  phi: number; // azimuth from +X toward +Y, 0..2pi
  azimuthDefined: boolean; // false at the poles and at the origin
}

const TAU = 2 * Math.PI;

export function toSpherical(v: Vec3): Spherical {
  const [x, y, z] = v;
  const r = Math.hypot(x, y, z);
  if (r < 1e-12) return { r: 0, theta: 0, phi: 0, azimuthDefined: false };
  const theta = Math.acos(Math.min(1, Math.max(-1, z / r)));
  const phi = ((Math.atan2(y, x) % TAU) + TAU) % TAU;
  return { r, theta, phi, azimuthDefined: Math.hypot(x, y) > 1e-9 };
}

export function fromSpherical(r: number, theta: number, phi: number): Vec3 {
  const s = Math.sin(theta);
  return [r * s * Math.cos(phi), r * s * Math.sin(phi), r * Math.cos(theta)];
}
