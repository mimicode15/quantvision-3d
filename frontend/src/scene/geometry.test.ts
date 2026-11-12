import { describe, expect, it } from "vitest";
import {
  AXIS_EXTENT,
  HEAD_LENGTH,
  WEDGE_RADIUS,
  WEDGE_SEGMENTS,
  WIRE_RING_COUNT,
  WIRE_SEGMENTS,
  axisSegments,
  fillWorldPositions,
  latitudeLoop,
  loopToSegments,
  meridianLoop,
  needleDimensions,
  phaseTickSegments,
  shadowPoints,
  sphereWireSegments,
  tickSegments,
  toWorldPositions,
  wedgeFan,
  wedgeIndices,
} from "./geometry";

const radius = (p: readonly number[]) => Math.hypot(p[0] as number, p[1] as number, p[2] as number);

describe("sphere wireframe", () => {
  it("is sparse: 12 rings at most", () => {
    expect(WIRE_RING_COUNT).toBeLessThanOrEqual(12);
    expect(sphereWireSegments()).toHaveLength(WIRE_RING_COUNT * WIRE_SEGMENTS * 2);
  });

  it("lies exactly on the unit sphere", () => {
    for (const p of sphereWireSegments()) expect(radius(p)).toBeCloseTo(1, 12);
  });

  it("has circles of latitude at the right height", () => {
    for (const p of latitudeLoop(Math.PI / 6)) expect(p[2]).toBeCloseTo(0.5, 12);
  });

  it("has meridians through both poles", () => {
    const points = meridianLoop(0.7);
    expect(points.some((p) => Math.abs(p[2] - 1) < 1e-9)).toBe(true);
    expect(points.some((p) => Math.abs(p[2] + 1) < 1e-9)).toBe(true);
  });

  it("turns loops into closed segment pairs", () => {
    const segs = loopToSegments([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(segs).toHaveLength(6);
    expect(segs[5]).toEqual([1, 0, 0]); // the last segment closes back to the start
  });
});

describe("axes, ticks and the phase dial", () => {
  it("draws three axes that pass through the centre", () => {
    const axes = axisSegments();
    expect(axes).toHaveLength(6);
    expect(axes[1]).toEqual([AXIS_EXTENT, 0, 0]);
    expect(axes[5]).toEqual([0, 0, AXIS_EXTENT]);
  });

  it("has 12 ticks per axis side pair set", () => {
    expect(tickSegments()).toHaveLength(4 * 3 * 2);
  });

  it("puts phase ticks every 30 degrees on the equator, outer end on the rim", () => {
    const ticks = phaseTickSegments();
    expect(ticks).toHaveLength(24);
    for (let i = 0; i < ticks.length; i += 2) {
      expect(ticks[i][2]).toBe(0);
      expect(radius(ticks[i + 1])).toBeCloseTo(1, 12);
      expect(radius(ticks[i])).toBeLessThan(1);
    }
  });
});

describe("phase wedge", () => {
  it("sweeps from +X to the azimuth", () => {
    const fan = wedgeFan(Math.PI / 2);
    expect(fan).toHaveLength(WEDGE_SEGMENTS + 2);
    expect(fan[0]).toEqual([0, 0, 0]);
    expect(fan[1][0]).toBeCloseTo(WEDGE_RADIUS, 12);
    expect(fan[1][1]).toBeCloseTo(0, 12);
    const end = fan[fan.length - 1];
    expect(end[0]).toBeCloseTo(0, 12);
    expect(end[1]).toBeCloseTo(WEDGE_RADIUS, 12);
  });

  it("indexes one triangle per segment", () => {
    const indices = wedgeIndices();
    expect(indices).toHaveLength(WEDGE_SEGMENTS * 3);
    expect(Math.max(...indices)).toBe(WEDGE_SEGMENTS + 1);
  });
});

describe("needle", () => {
  it("has a shaft plus a cone head that add up to the length", () => {
    const d = needleDimensions(1);
    expect(d.shaft + d.head).toBeCloseTo(1, 12);
    expect(d.head).toBeCloseTo(HEAD_LENGTH, 12);
  });

  it("shrinks its head when the needle is shorter than the head", () => {
    const d = needleDimensions(0.08);
    expect(d.shaft).toBe(0);
    expect(d.head).toBeCloseTo(0.08, 12);
    expect(d.headRadius).toBeCloseTo(0.035 / 2, 12);
  });

  it("never goes negative", () => {
    const d = needleDimensions(-1);
    expect(d.shaft).toBe(0);
    expect(d.head).toBe(0);
  });

  it("drops its shadow straight down to the equatorial plane", () => {
    const { tip, foot } = shadowPoints([0.3, 0.4, 0.5]);
    expect(tip).toEqual([0.3, 0.4, 0.5]);
    expect(foot).toEqual([0.3, 0.4, 0]);
  });
});

describe("world-frame buffers", () => {
  it("maps Bloch z to world y and Bloch y to world -z", () => {
    const out = toWorldPositions([[1, 2, 3]]);
    expect(Array.from(out)).toEqual([1, 3, -2]);
  });

  it("applies a lift along world y and fills in place", () => {
    const target = new Float32Array(3);
    fillWorldPositions(target, [[0, 0, 0]], 0.5);
    expect(Array.from(target)).toEqual([0, 0.5, 0]);
  });
});
