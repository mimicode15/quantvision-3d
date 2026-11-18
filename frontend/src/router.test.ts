import { describe, expect, it } from "vitest";
import { parseRoute } from "./router";

describe("parseRoute", () => {
  it("knows the playground", () => {
    expect(parseRoute("#/play")).toBe("play");
    expect(parseRoute("#play")).toBe("play");
    expect(parseRoute("#/play?x=1")).toBe("play");
  });

  it("falls back to home", () => {
    expect(parseRoute("")).toBe("home");
    expect(parseRoute("#/")).toBe("home");
    expect(parseRoute("#/nope")).toBe("home");
    expect(parseRoute("#/playground")).toBe("home");
  });
});
