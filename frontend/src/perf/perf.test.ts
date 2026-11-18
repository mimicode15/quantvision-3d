import { describe, expect, it } from "vitest";
import { FrameStats } from "./FrameStats";
import { QualityGovernor } from "./QualityGovernor";
import { RenderGate } from "./RenderGate";

describe("FrameStats", () => {
  it("reports fps, average and worst frame", () => {
    const stats = new FrameStats();
    for (let i = 0; i < 10; i++) stats.add(16);
    stats.add(60);
    expect(stats.count).toBe(11);
    expect(stats.worstMs).toBe(60);
    expect(Math.abs(stats.avgMs - (160 + 60) / 11)).toBeLessThan(1e-9);
    expect(Math.abs(stats.fps - 1000 / stats.avgMs)).toBeLessThan(1e-9);
    expect(Math.abs(stats.slowShare - 1 / 11)).toBeLessThan(1e-9);
  });

  it("only keeps the latest window", () => {
    const stats = new FrameStats(5);
    for (let i = 0; i < 5; i++) stats.add(100);
    for (let i = 0; i < 5; i++) stats.add(10);
    expect(stats.count).toBe(5);
    expect(stats.worstMs).toBe(10);
  });

  it("is zero when empty", () => {
    const stats = new FrameStats();
    expect([stats.fps, stats.avgMs, stats.worstMs, stats.slowShare]).toEqual([0, 0, 0, 0]);
  });
});

describe("QualityGovernor", () => {
  it("starts at the device pixel ratio", () => {
    expect(new QualityGovernor(2).pixelRatio).toBe(2);
    expect(new QualityGovernor(3).pixelRatio).toBe(3);
    expect(new QualityGovernor(1).pixelRatio).toBe(1);
  });

  it("steps down only after frames stay slow for a while", () => {
    const g = new QualityGovernor(2);
    let t = 0;
    let changed: number | null = null;
    for (; t < 1900; t += 16) changed = g.update(t, 30) ?? changed;
    expect(changed).toBeNull();
    expect(g.update(t + 200, 30)).toBe(1.5);
    expect(g.pixelRatio).toBe(1.5);
  });

  it("ignores a short slow spell", () => {
    const g = new QualityGovernor(2);
    for (let t = 0; t < 1000; t += 16) g.update(t, 20);
    g.update(1100, 60); // recovered
    for (let t = 1200; t < 2500; t += 16) expect(g.update(t, 20)).toBeNull();
    expect(g.pixelRatio).toBe(2);
  });

  it("waits out a cooldown between steps and stops at the lowest tier", () => {
    const g = new QualityGovernor(2);
    const seen: number[] = [];
    for (let t = 0; t < 60000; t += 16) {
      const r = g.update(t, 10);
      if (r !== null) seen.push(r);
    }
    expect(seen).toEqual([1.5, 1, 0.75]);
    expect(g.pixelRatio).toBe(0.75);
  });

  it("never goes back up", () => {
    const g = new QualityGovernor(2);
    for (let t = 0; t < 3000; t += 16) g.update(t, 10);
    const dropped = g.pixelRatio;
    for (let t = 3000; t < 40000; t += 16) g.update(t, 60);
    expect(g.pixelRatio).toBe(dropped);
  });

  it("idle() resets the slow timer", () => {
    const g = new QualityGovernor(2);
    for (let t = 0; t < 1500; t += 16) g.update(t, 10);
    g.idle();
    expect(g.update(2100, 10)).toBeNull();
  });
});

describe("RenderGate", () => {
  it("draws the first frame, then skips while nothing moves", () => {
    const gate = new RenderGate();
    expect(gate.shouldRender(false)).toBe(true);
    expect(gate.shouldRender(false)).toBe(false);
    expect(gate.shouldRender(false)).toBe(false);
  });

  it("draws while moving and once more after it stops", () => {
    const gate = new RenderGate();
    gate.shouldRender(false);
    expect(gate.shouldRender(true)).toBe(true);
    expect(gate.shouldRender(true)).toBe(true);
    expect(gate.shouldRender(false)).toBe(true); // the resting frame
    expect(gate.shouldRender(false)).toBe(false);
  });

  it("invalidate forces one draw", () => {
    const gate = new RenderGate();
    gate.shouldRender(false);
    gate.invalidate();
    expect(gate.shouldRender(false)).toBe(true);
    expect(gate.shouldRender(false)).toBe(false);
  });
});
