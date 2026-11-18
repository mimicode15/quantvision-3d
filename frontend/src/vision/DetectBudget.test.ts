import { describe, expect, it } from "vitest";
import { DetectBudget } from "./DetectBudget";
import { withTimeout } from "./timeout";

describe("DetectBudget", () => {
  it("runs every frame while detection is cheap", () => {
    const b = new DetectBudget();
    for (let i = 0; i < 20; i++) b.record(8);
    expect(b.intervalMs).toBe(0);
  });

  it("spaces detections out when they get slow", () => {
    const b = new DetectBudget();
    for (let i = 0; i < 50; i++) b.record(30);
    expect(Math.abs(b.intervalMs - 60)).toBeLessThan(1);
  });

  it("caps the gap so tracking never freezes", () => {
    const b = new DetectBudget();
    for (let i = 0; i < 50; i++) b.record(200);
    expect(b.intervalMs).toBe(100);
  });

  it("recovers when detection speeds up", () => {
    const b = new DetectBudget();
    for (let i = 0; i < 20; i++) b.record(40);
    expect(b.intervalMs).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) b.record(5);
    expect(b.intervalMs).toBe(0);
  });
});

describe("withTimeout", () => {
  it("passes the result through", async () => {
    expect(await withTimeout(Promise.resolve(7), 50, () => new Error("slow"))).toBe(7);
  });

  it("rejects with the given error when too slow", async () => {
    const never = new Promise<number>(() => {});
    let message = "";
    try {
      await withTimeout(never, 20, () => new Error("too slow"));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("too slow");
  });

  it("passes rejections through", async () => {
    let message = "";
    try {
      await withTimeout(Promise.reject(new Error("boom")), 50, () => new Error("slow"));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("boom");
  });
});
