import type { Vec3 } from "../math/quantum";
import type { Noise } from "../math/decoherence";

const BASE_URL: string = import.meta.env?.VITE_API_URL ?? "http://localhost:8000";

export interface NoiseRequest extends Noise {
  theta: number;
  phi: number;
}

export interface NoiseReply {
  bloch: Vec3;
  purity: number;
}

interface Options {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Asks the FastAPI server for the same evolution the browser just computed. */
export async function evolveOnServer(
  req: NoiseRequest,
  { baseUrl = BASE_URL, timeoutMs = 3000, fetchImpl = fetch }: Options = {},
): Promise<NoiseReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl}/noise/evolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`server answered ${res.status}`);
    const data = await res.json();
    return { bloch: [data.bloch.x, data.bloch.y, data.bloch.z], purity: data.purity };
  } finally {
    clearTimeout(timer);
  }
}

export type CheckResult =
  | { status: "agree"; maxDiff: number }
  | { status: "differ"; maxDiff: number }
  | { status: "offline" };

/** Compares the server's answer with the browser's. Never throws: a dead server is "offline". */
export async function checkAgainstServer(
  req: NoiseRequest,
  local: Vec3,
  options: Options = {},
  tolerance = 1e-6,
): Promise<CheckResult> {
  try {
    const reply = await evolveOnServer(req, options);
    const maxDiff = Math.max(...reply.bloch.map((v, i) => Math.abs(v - (local[i] as number))));
    return { status: maxDiff <= tolerance ? "agree" : "differ", maxDiff };
  } catch {
    return { status: "offline" };
  }
}
