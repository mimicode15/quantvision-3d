import { describe, expect, it } from "vitest";
import { classifyCameraError } from "./CameraManager";
import { VisionError } from "./errors";

const named = (name: string) => ({ name, message: "x" });

describe("classifyCameraError", () => {
  it("maps permission failures to denied", () => {
    for (const name of ["NotAllowedError", "PermissionDeniedError", "SecurityError"]) {
      expect(classifyCameraError(named(name)).kind).toBe("denied");
    }
  });

  it("maps missing hardware to not-found", () => {
    for (const name of ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"]) {
      expect(classifyCameraError(named(name)).kind).toBe("not-found");
    }
  });

  it("maps busy hardware to in-use", () => {
    for (const name of ["NotReadableError", "TrackStartError", "AbortError"]) {
      expect(classifyCameraError(named(name)).kind).toBe("in-use");
    }
  });

  it("falls back to unknown for anything else, including non-errors", () => {
    expect(classifyCameraError(named("WeirdError")).kind).toBe("unknown");
    expect(classifyCameraError("boom").kind).toBe("unknown");
    expect(classifyCameraError(undefined).kind).toBe("unknown");
    expect(classifyCameraError(null).kind).toBe("unknown");
  });

  it("returns a VisionError with a human message and keeps the original as cause", () => {
    const original = named("NotAllowedError");
    const error = classifyCameraError(original);
    expect(error).toBeInstanceOf(VisionError);
    expect(error.message).toContain("blocked");
    expect(error.cause).toBe(original);
  });
});
