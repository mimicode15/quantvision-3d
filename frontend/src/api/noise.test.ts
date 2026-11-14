import { describe, expect, it } from "vitest";
import { checkAgainstServer, evolveOnServer } from "./noise";

const req = { theta: 1, phi: 2, t: 10, t1: 100, t2: 80 };

const reply = (body: unknown, ok = true, status = 200) =>
  (async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch;

const body = { bloch: { x: 0.1, y: 0.2, z: 0.3 }, purity: 0.9 };

describe("evolveOnServer", () => {
  it("posts to /noise/evolve and unpacks the answer", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return { ok: true, status: 200, json: async () => body };
    }) as unknown as typeof fetch;

    const out = await evolveOnServer(req, { baseUrl: "http://api.test", fetchImpl });
    expect(seen?.url).toBe("http://api.test/noise/evolve");
    expect(seen?.init.method).toBe("POST");
    expect(JSON.parse(seen?.init.body as string)).toEqual(req);
    expect(out).toEqual({ bloch: [0.1, 0.2, 0.3], purity: 0.9 });
  });

  it("throws when the server says no", async () => {
    const fetchImpl = reply({}, false, 422);
    let message = "";
    try {
      await evolveOnServer(req, { fetchImpl });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("422");
  });
});

describe("checkAgainstServer", () => {
  it("agrees when the numbers match", async () => {
    const out = await checkAgainstServer(req, [0.1, 0.2, 0.3], { fetchImpl: reply(body) });
    expect(out.status).toBe("agree");
  });

  it("flags a difference", async () => {
    const out = await checkAgainstServer(req, [0.1, 0.2, 0.5], { fetchImpl: reply(body) });
    expect(out.status).toBe("differ");
    if (out.status === "differ") expect(out.maxDiff).toBeGreaterThan(0.19);
  });

  it("is offline when the request fails", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const out = await checkAgainstServer(req, [0, 0, 1], { fetchImpl });
    expect(out.status).toBe("offline");
  });

  it("is offline on an error status", async () => {
    const out = await checkAgainstServer(req, [0, 0, 1], { fetchImpl: reply({}, false, 500) });
    expect(out.status).toBe("offline");
  });
});
