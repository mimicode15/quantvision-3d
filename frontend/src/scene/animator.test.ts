import { describe, expect, it } from "vitest";
import type { Vec3 } from "../math/quantum";
import { StateAnimator } from "./animator";

const close = (a: readonly number[], b: readonly number[], digits = 6) => {
  a.forEach((value, i) => expect(value).toBeCloseTo(b[i] as number, digits));
};
const run = (animator: StateAnimator, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) animator.step(1 / 60);
};
const deg = (d: number) => (d * Math.PI) / 180;

describe("StateAnimator", () => {
  it("starts at |0>", () => {
    close(new StateAnimator().bloch, [0, 0, 1]);
  });

  it("settles on any target", () => {
    const a = new StateAnimator();
    for (const target of [
      [1, 0, 0],
      [0, -1, 0],
      [0.5, 0.5, -0.7071],
      [0, 0, -1],
    ] as Vec3[]) {
      a.setTarget(target);
      run(a, 3);
      close(a.bloch, target, 4);
      expect(a.settled).toBe(true);
    }
  });

  it("takes the short way round in azimuth", () => {
    const a = new StateAnimator(14, [Math.cos(deg(350)), Math.sin(deg(350)), 0]);
    a.setTarget([Math.cos(deg(10)), Math.sin(deg(10)), 0]);
    a.step(0.02);
    // moving +20 degrees through 0, so the wrapped azimuth rises from 350 toward 360
    expect(a.phi).toBeGreaterThan(deg(350));
    expect(a.phi).toBeLessThan(deg(360));
  });

  it("leaves the azimuth alone when the target is a pole", () => {
    const a = new StateAnimator(14, [Math.cos(1), Math.sin(1), 0]);
    a.setTarget([0, 0, 1]);
    run(a, 3);
    close(a.bloch, [0, 0, 1], 4);
    expect(a.phi).toBeCloseTo(1, 6);
  });

  it("keeps its direction while the needle shrinks (noise)", () => {
    const a = new StateAnimator(14, [0.6, 0, 0.8]);
    a.setTarget([0.3, 0, 0.4]);
    run(a, 3);
    close(a.bloch, [0.3, 0, 0.4], 4);
    expect(a.radius).toBeCloseTo(0.5, 4);
  });

  it("can shrink all the way to the centre", () => {
    const a = new StateAnimator(14, [0.6, 0, 0.8]);
    a.setTarget([0, 0, 0]);
    run(a, 3);
    expect(a.radius).toBeCloseTo(0, 4);
  });

  it("snapTo jumps without animating", () => {
    const a = new StateAnimator();
    a.snapTo([0, 1, 0]);
    close(a.bloch, [0, 1, 0], 12);
    expect(a.settled).toBe(true);
  });
});
