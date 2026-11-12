import { describe, expect, it } from "vitest";
import type { Vec3 } from "../math/quantum";
import { blochToWorld, fromSpherical, toSpherical, worldToBloch } from "./coords";

const close = (a: readonly number[], b: readonly number[], digits = 10) => {
  expect(a).toHaveLength(b.length);
  a.forEach((value, i) => expect(value).toBeCloseTo(b[i] as number, digits));
};

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

describe("Bloch <-> world frame", () => {
  it("puts |0> straight up", () => {
    close(blochToWorld([0, 0, 1]), [0, 1, 0]);
    close(blochToWorld([1, 0, 0]), [1, 0, 0]);
    close(blochToWorld([0, 1, 0]), [0, 0, -1]);
  });

  it("is a proper rotation, so handedness is preserved", () => {
    const ex = blochToWorld([1, 0, 0]);
    const ey = blochToWorld([0, 1, 0]);
    const ez = blochToWorld([0, 0, 1]);
    expect(dot(ex, cross(ey, ez))).toBeCloseTo(1, 12);
  });

  it("round-trips", () => {
    const v: Vec3 = [0.3, -0.5, 0.7];
    close(worldToBloch(blochToWorld(v)), v);
  });
});

describe("spherical coordinates", () => {
  it("reads the standard states", () => {
    const up = toSpherical([0, 0, 1]);
    expect(up.theta).toBeCloseTo(0, 12);
    expect(up.azimuthDefined).toBe(false);

    const plus = toSpherical([1, 0, 0]);
    expect(plus.theta).toBeCloseTo(Math.PI / 2, 12);
    expect(plus.phi).toBeCloseTo(0, 12);

    expect(toSpherical([0, 1, 0]).phi).toBeCloseTo(Math.PI / 2, 12);
    expect(toSpherical([0, -1, 0]).phi).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(toSpherical([0, 0, -1]).theta).toBeCloseTo(Math.PI, 12);
  });

  it("has no direction at the origin", () => {
    const s = toSpherical([0, 0, 0]);
    expect(s.r).toBe(0);
    expect(s.azimuthDefined).toBe(false);
  });

  it("round-trips through (r, theta, phi)", () => {
    for (const v of [
      [0.2, 0.3, -0.4],
      [-0.6, 0.1, 0.5],
      [0.0, -0.9, 0.1],
    ] as Vec3[]) {
      const s = toSpherical(v);
      close(fromSpherical(s.r, s.theta, s.phi), v);
    }
  });
});
