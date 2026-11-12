import { describe, expect, it } from "vitest";
import { checkAsset } from "./HandTracker";
import { VisionError } from "./errors";

const respond = (init: { ok?: boolean; type?: string }): typeof fetch =>
  (async () => ({
    ok: init.ok ?? true,
    headers: { get: () => init.type ?? "application/octet-stream" },
  })) as unknown as typeof fetch;

const kindOf = async (fn: () => Promise<void>): Promise<string> => {
  try {
    await fn();
    return "none";
  } catch (error) {
    return error instanceof VisionError ? error.kind : "other";
  }
};

describe("checkAsset", () => {
  it("accepts a real binary file", async () => {
    expect(await kindOf(() => checkAsset("/m.task", respond({})))).toBe("none");
  });

  it("rejects the HTML page Vite serves for a missing file", async () => {
    const fetcher = respond({ type: "text/html; charset=utf-8" });
    expect(await kindOf(() => checkAsset("/m.task", fetcher))).toBe("model-missing");
  });

  it("rejects a 404", async () => {
    expect(await kindOf(() => checkAsset("/m.task", respond({ ok: false })))).toBe("model-missing");
  });

  it("reports a network failure as tracker-failed", async () => {
    const failing = (async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    expect(await kindOf(() => checkAsset("/m.task", failing))).toBe("tracker-failed");
  });
});
