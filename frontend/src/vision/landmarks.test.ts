import { describe, expect, it } from "vitest";
import {
  FpsMeter,
  HAND,
  HAND_CONNECTIONS,
  LANDMARK_COUNT,
  distance,
  isValidHand,
  mirrorX,
  type Landmark,
} from "./landmarks";

const hand = (fill: Landmark = { x: 0.5, y: 0.5, z: 0 }): Landmark[] =>
  Array.from({ length: LANDMARK_COUNT }, () => ({ ...fill }));

describe("hand skeleton", () => {
  it("has the 21 standard bones", () => {
    expect(HAND_CONNECTIONS).toHaveLength(21);
  });

  it("only refers to real landmark indices, with no self-loops or duplicates", () => {
    const seen = new Set<string>();
    for (const [a, b] of HAND_CONNECTIONS) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(LANDMARK_COUNT);
      expect(a === b).toBe(false);
      const key = [Math.min(a, b), Math.max(a, b)].join("-");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("connects every landmark to the rest of the hand", () => {
    const touched = new Set<number>();
    for (const [a, b] of HAND_CONNECTIONS) {
      touched.add(a);
      touched.add(b);
    }
    expect(touched.size).toBe(LANDMARK_COUNT);
  });

  it("names the fingertips at MediaPipe's indices", () => {
    expect(HAND.THUMB_TIP).toBe(4);
    expect(HAND.INDEX_TIP).toBe(8);
    expect(HAND.MIDDLE_TIP).toBe(12);
    expect(HAND.RING_TIP).toBe(16);
    expect(HAND.PINKY_TIP).toBe(20);
  });
});

describe("isValidHand", () => {
  it("accepts 21 finite landmarks", () => {
    expect(isValidHand(hand())).toBe(true);
  });

  it("rejects missing data, wrong counts and non-finite numbers", () => {
    expect(isValidHand(undefined)).toBe(false);
    expect(isValidHand(null)).toBe(false);
    expect(isValidHand([])).toBe(false);
    expect(isValidHand(hand().slice(0, 20))).toBe(false);
    const bad = hand();
    bad[3] = { x: Number.NaN, y: 0, z: 0 };
    expect(isValidHand(bad)).toBe(false);
  });
});

describe("mirrorX and distance", () => {
  it("flips x about the middle of the frame and leaves y and z alone", () => {
    const [p] = mirrorX([{ x: 0.2, y: 0.3, z: -0.1 }]);
    expect(p?.x).toBeCloseTo(0.8, 12);
    expect(p?.y).toBe(0.3);
    expect(p?.z).toBe(-0.1);
  });

  it("is its own inverse", () => {
    const original = [{ x: 0.25, y: 0.5, z: 0.125 }];
    expect(mirrorX(mirrorX(original))).toEqual(original);
  });

  it("measures Euclidean distance in 3D", () => {
    expect(distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 12 })).toBe(13);
  });
});

describe("FpsMeter", () => {
  it("reads 0 until it has two frames", () => {
    const meter = new FpsMeter();
    expect(meter.fps).toBe(0);
    meter.tick(0);
    expect(meter.fps).toBe(0);
  });

  it("measures a steady 30 fps", () => {
    const meter = new FpsMeter();
    for (let i = 0; i < 90; i++) meter.tick(i * (1000 / 30));
    expect(meter.fps).toBeCloseTo(30, 6);
  });

  it("forgets frames older than the window", () => {
    const meter = new FpsMeter(1000);
    for (let i = 0; i < 60; i++) meter.tick(i * 10); // fast burst: 100 fps
    for (let i = 1; i <= 60; i++) meter.tick(600 + i * 100); // then 10 fps
    expect(meter.fps).toBeCloseTo(10, 6);
  });

  it("resets", () => {
    const meter = new FpsMeter();
    meter.tick(0);
    meter.tick(100);
    meter.reset();
    expect(meter.fps).toBe(0);
  });
});
