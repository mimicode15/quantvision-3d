import { describe, expect, it } from "vitest";
import {
  FINGERS,
  isFingerExtended,
  isOpenPalm,
  palmCenterY,
  palmFacing,
  pinchRatio,
  wrap2Pi,
  wrapPi,
  wristTilt,
} from "./gestures";
import { makeHand } from "./handFixtures";

const THRESHOLDS = { fingerStraightCos: 0.8, palmFacingMin: 0.7 };
const deg = (d: number) => (d * Math.PI) / 180;

describe("angle wrapping", () => {
  it("wrapPi lands in (-pi, pi]", () => {
    expect(wrapPi(0)).toBe(0);
    expect(wrapPi(deg(190))).toBeCloseTo(deg(-170), 12);
    expect(wrapPi(deg(-190))).toBeCloseTo(deg(170), 12);
    expect(wrapPi(Math.PI)).toBe(Math.PI);
    expect(wrapPi(-Math.PI)).toBe(Math.PI);
    expect(wrapPi(deg(720 + 30))).toBeCloseTo(deg(30), 12);
  });

  it("wrap2Pi lands in [0, 2pi)", () => {
    expect(wrap2Pi(deg(-90))).toBeCloseTo(deg(270), 12);
    expect(wrap2Pi(deg(450))).toBeCloseTo(deg(90), 12);
    expect(wrap2Pi(0)).toBe(0);
  });
});

describe("pinchRatio", () => {
  it("is about 1 with an open hand and near 0 when pinched", () => {
    expect(pinchRatio(makeHand({ pinch: 0 }).worldLandmarks)).toBeGreaterThan(1);
    expect(pinchRatio(makeHand({ pinch: 1 }).worldLandmarks)).toBeLessThan(0.05);
  });

  it("falls steadily as the thumb closes in", () => {
    const ratios = [0, 0.25, 0.5, 0.75, 1].map((p) =>
      pinchRatio(makeHand({ pinch: p }).worldLandmarks),
    );
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i] as number).toBeLessThan(ratios[i - 1] as number);
    }
  });

  it("doesn't depend on hand size or position in the frame", () => {
    const near = pinchRatio(makeHand({ pinch: 0.6, size: 0.35, cx: 0.3, cy: 0.5 }).worldLandmarks);
    const far = pinchRatio(makeHand({ pinch: 0.6, size: 0.1, cx: 0.7, cy: 0.8 }).worldLandmarks);
    expect(near).toBeCloseTo(far, 9);
  });

  it("doesn't depend on wrist roll", () => {
    const flat = pinchRatio(makeHand({ pinch: 0.6 }).worldLandmarks);
    const rolled = pinchRatio(makeHand({ pinch: 0.6, tiltDeg: 40 }).worldLandmarks);
    expect(rolled).toBeCloseTo(flat, 9);
  });
});

describe("open palm detection", () => {
  it("accepts a flat open hand", () => {
    expect(isOpenPalm(makeHand().worldLandmarks, THRESHOLDS)).toBe(true);
  });

  it("still accepts it when rolled, moved or at a different distance", () => {
    expect(isOpenPalm(makeHand({ tiltDeg: 30, size: 0.3 }).worldLandmarks, THRESHOLDS)).toBe(true);
    expect(isOpenPalm(makeHand({ cx: 0.2, cy: 0.3 }).worldLandmarks, THRESHOLDS)).toBe(true);
  });

  it("rejects a fist, a peace sign and a single raised finger", () => {
    const all = ["index", "middle", "ring", "pinky"] as const;
    expect(isOpenPalm(makeHand({ curled: all }).worldLandmarks, THRESHOLDS)).toBe(false);
    expect(isOpenPalm(makeHand({ curled: ["ring", "pinky"] }).worldLandmarks, THRESHOLDS)).toBe(
      false,
    );
    expect(
      isOpenPalm(makeHand({ curled: ["middle", "ring", "pinky"] }).worldLandmarks, THRESHOLDS),
    ).toBe(false);
  });

  it("rejects a palm turned edge-on to the camera", () => {
    expect(isOpenPalm(makeHand({ yawDeg: 90 }).worldLandmarks, THRESHOLDS)).toBe(false);
    expect(isOpenPalm(makeHand({ yawDeg: 60 }).worldLandmarks, THRESHOLDS)).toBe(false);
  });

  it("measures how squarely the palm faces the camera", () => {
    expect(palmFacing(makeHand().worldLandmarks)).toBeCloseTo(1, 6);
    expect(palmFacing(makeHand({ yawDeg: 90 }).worldLandmarks)).toBeCloseTo(0, 6);
    expect(palmFacing(makeHand({ yawDeg: 30 }).worldLandmarks)).toBeCloseTo(Math.cos(deg(30)), 6);
  });

  it("judges one finger at a time", () => {
    const hand = makeHand({ curled: ["ring"] }).worldLandmarks;
    expect(isFingerExtended(hand, FINGERS.index, 0.8)).toBe(true);
    expect(isFingerExtended(hand, FINGERS.ring, 0.8)).toBe(false);
  });
});

describe("palm height and wrist tilt", () => {
  it("palm height follows the hand's vertical position", () => {
    const high = palmCenterY(makeHand({ cy: 0.3 }).landmarks);
    const low = palmCenterY(makeHand({ cy: 0.7 }).landmarks);
    expect(low - high).toBeCloseTo(0.4, 6);
  });

  it("palm height barely moves when pinching", () => {
    const open = palmCenterY(makeHand({ pinch: 0 }).landmarks);
    const pinched = palmCenterY(makeHand({ pinch: 1 }).landmarks);
    expect(pinched).toBeCloseTo(open, 9);
  });

  it("tilt is positive when the hand leans to the user's right, and tracks the angle", () => {
    const flat = wristTilt(makeHand().landmarks, 4 / 3);
    expect(wristTilt(makeHand({ tiltDeg: 20 }).landmarks, 4 / 3) - flat).toBeCloseTo(deg(20), 6);
    expect(wristTilt(makeHand({ tiltDeg: -35 }).landmarks, 4 / 3) - flat).toBeCloseTo(deg(-35), 6);
  });

  it("gives the same tilt on a widescreen frame once aspect is supplied", () => {
    const wide = 16 / 9;
    const flat = wristTilt(makeHand({ aspect: wide }).landmarks, wide);
    const tilted = wristTilt(makeHand({ aspect: wide, tiltDeg: 25 }).landmarks, wide);
    expect(tilted - flat).toBeCloseTo(deg(25), 6);
  });
});
