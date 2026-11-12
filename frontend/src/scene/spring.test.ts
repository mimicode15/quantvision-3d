import { describe, expect, it } from "vitest";
import { Spring, nearestAngle } from "./spring";

describe("Spring", () => {
  it("settles on its target", () => {
    const s = new Spring(0, 14);
    s.target = 1;
    for (let i = 0; i < 120; i++) s.step(1 / 60);
    expect(s.value).toBeCloseTo(1, 4);
    expect(s.settled).toBe(true);
  });

  it("never overshoots when released from rest", () => {
    const s = new Spring(0, 14);
    s.target = 1;
    let previous = 0;
    for (let i = 0; i < 240; i++) {
      s.step(1 / 120);
      expect(s.value).toBeLessThanOrEqual(1 + 1e-12);
      expect(s.value).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = s.value;
    }
  });

  it("gives the same answer however the time is sliced", () => {
    const coarse = new Spring(0, 14);
    const fine = new Spring(0, 14);
    coarse.target = fine.target = 2;
    coarse.step(0.3);
    for (let i = 0; i < 300; i++) fine.step(0.001);
    expect(coarse.value).toBeCloseTo(fine.value, 9);
    expect(coarse.velocity).toBeCloseTo(fine.velocity, 9);
  });

  it("is stable after a long frame", () => {
    const s = new Spring(0, 40);
    s.target = 1;
    s.step(5);
    expect(s.value).toBeCloseTo(1, 9);
  });

  it("snaps instantly and clears velocity", () => {
    const s = new Spring(0, 14);
    s.target = 1;
    s.step(0.05);
    s.snap(3);
    expect(s.value).toBe(3);
    expect(s.target).toBe(3);
    expect(s.velocity).toBe(0);
  });
});

describe("nearestAngle", () => {
  const TAU = 2 * Math.PI;
  const deg = (d: number) => (d * Math.PI) / 180;

  it("takes the short way round the circle", () => {
    expect(nearestAngle(deg(350), deg(10))).toBeCloseTo(deg(370), 12);
    expect(nearestAngle(deg(10), deg(350))).toBeCloseTo(deg(-10), 12);
    expect(nearestAngle(deg(90), deg(100))).toBeCloseTo(deg(100), 12);
  });

  it("works for unwrapped values", () => {
    expect(nearestAngle(3 * TAU + 0.1, 0.2)).toBeCloseTo(3 * TAU + 0.2, 12);
  });
});
