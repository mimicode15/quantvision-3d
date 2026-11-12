import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, type Landmark } from "./landmarks";
import { parseHandResult } from "./parse";

const points = (offset = 0): Landmark[] =>
  Array.from({ length: LANDMARK_COUNT }, (_, i) => ({ x: i / 100 + offset, y: 0.5, z: -0.02 }));

describe("parseHandResult", () => {
  it("returns no hand for an empty result", () => {
    expect(parseHandResult({ landmarks: [], worldLandmarks: [], handedness: [] }, 5)).toEqual({
      timestamp: 5,
      hand: null,
    });
  });

  it("survives garbage input", () => {
    expect(parseHandResult(undefined, 1).hand).toBeNull();
    expect(parseHandResult(null, 1).hand).toBeNull();
    expect(parseHandResult({}, 1).hand).toBeNull();
    expect(parseHandResult({ landmarks: [[{ x: 0, y: 0, z: 0 }]] }, 1).hand).toBeNull();
  });

  it("reads landmarks, world landmarks and handedness", () => {
    const frame = parseHandResult(
      {
        landmarks: [points()],
        worldLandmarks: [points(1)],
        handedness: [[{ categoryName: "Right", score: 0.97 }]],
      },
      42,
    );
    expect(frame.timestamp).toBe(42);
    expect(frame.hand?.landmarks).toHaveLength(21);
    expect(frame.hand?.landmarks[5]?.x).toBeCloseTo(0.05, 12);
    expect(frame.hand?.worldLandmarks[0]?.x).toBe(1);
    expect(frame.hand?.handedness).toBe("Right");
    expect(frame.hand?.score).toBe(0.97);
  });

  it("accepts the older 'handednesses' spelling", () => {
    const frame = parseHandResult(
      { landmarks: [points()], handednesses: [[{ categoryName: "Left", score: 0.5 }]] },
      1,
    );
    expect(frame.hand?.handedness).toBe("Left");
  });

  it("copies data instead of aliasing MediaPipe's objects", () => {
    const raw = { landmarks: [points()] };
    const frame = parseHandResult(raw, 1);
    (raw.landmarks[0] as Landmark[])[0] = { x: 9, y: 9, z: 9 };
    expect(frame.hand?.landmarks[0]?.x).toBe(0);
  });

  it("falls back to image landmarks when world landmarks are missing, and to null handedness", () => {
    const frame = parseHandResult({ landmarks: [points()] }, 1);
    expect(frame.hand?.worldLandmarks).toEqual(frame.hand?.landmarks);
    expect(frame.hand?.handedness).toBeNull();
    expect(frame.hand?.score).toBe(0);
  });
});
