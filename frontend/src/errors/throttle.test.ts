import { describe, expect, it } from "vitest";
import { ErrorThrottle, isHarmless } from "./throttle";

describe("ErrorThrottle", () => {
  it("spaces toasts out and stops after a few", () => {
    const t = new ErrorThrottle(3, 5000);
    expect(t.allow(0)).toBe(true);
    expect(t.allow(1000)).toBe(false);
    expect(t.allow(5000)).toBe(true);
    expect(t.allow(10000)).toBe(true);
    expect(t.allow(20000)).toBe(false);
  });
});

describe("isHarmless", () => {
  it("skips browser noise but not real errors", () => {
    expect(isHarmless("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isHarmless("Script error.")).toBe(true);
    expect(isHarmless("TypeError: x is undefined")).toBe(false);
  });
});
