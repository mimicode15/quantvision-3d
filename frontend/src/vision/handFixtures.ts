import { LANDMARK_COUNT, type Landmark } from "./landmarks";
import type { HandResult } from "./parse";

/** Test helper: builds a plausible hand in any pose, as the camera would report it. Not used by the app. */

export interface HandPose {
  /** Wrist position in the frame the user sees (0..1, y down). */
  cx?: number;
  cy?: number;
  /** Roll in degrees, positive = fingers tilted to the user's right. */
  tiltDeg?: number;
  /** Turn about the vertical axis in degrees; 90 shows the palm edge-on. */
  yawDeg?: number;
  /** 0 = thumb open, 1 = thumb tip touching the index tip. */
  pinch?: number;
  /** Fingers folded into the palm. */
  curled?: ReadonlyArray<"index" | "middle" | "ring" | "pinky">;
  /** Hand length (wrist to middle knuckle) in frame-heights. */
  size?: number;
  /** Video width / height. */
  aspect?: number;
}

type P2 = readonly [number, number];

const rotate = ([x, y]: P2, degrees: number): P2 => {
  const a = (degrees * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

/** [MCP, PIP, DIP, TIP] for one finger in hand-local units (wrist-to-middle-knuckle = 1). */
const finger = (mcp: P2, lengths: [number, number, number], spreadDeg: number, curled: boolean) => {
  const out: P2[] = [mcp];
  const dir = rotate([0, 1], spreadDeg);
  let at = mcp;
  lengths.forEach((len, i) => {
    const step: P2 = curled && i > 0 ? [-dir[0] * 0.8, -dir[1] * 0.8] : dir;
    at = [at[0] + step[0] * len, at[1] + step[1] * len];
    out.push(at);
  });
  return out;
};

export function makeHand(pose: HandPose = {}): HandResult {
  const {
    cx = 0.5,
    cy = 0.6,
    tiltDeg = 0,
    yawDeg = 0,
    pinch = 0,
    size = 0.2,
    aspect = 4 / 3,
  } = pose;
  const curled = new Set(pose.curled ?? []);

  const index = finger([-0.3, 0.95], [0.45, 0.25, 0.22], -8, curled.has("index"));
  const middle = finger([-0.05, 1.0], [0.5, 0.28, 0.24], 0, curled.has("middle"));
  const ring = finger([0.18, 0.95], [0.45, 0.26, 0.22], 6, curled.has("ring"));
  const pinky = finger([0.38, 0.82], [0.35, 0.2, 0.18], 14, curled.has("pinky"));

  const indexTip = index[3] as P2;
  const openTip: P2 = [-0.98, 0.82];
  const thumbTip: P2 = [
    openTip[0] + (indexTip[0] - openTip[0]) * pinch,
    openTip[1] + (indexTip[1] - openTip[1]) * pinch,
  ];
  const thumb: P2[] = [
    [-0.35, 0.25],
    [-0.62, 0.5],
    [(-0.62 + thumbTip[0]) / 2 - 0.05, (0.5 + thumbTip[1]) / 2],
    thumbTip,
  ];

  const local: P2[] = [[0, 0], ...thumb, ...index, ...middle, ...ring, ...pinky];

  const yaw = (yawDeg * Math.PI) / 180;
  const image: Landmark[] = [];
  const world: Landmark[] = [];
  for (const [lx, ly] of local) {
    const x = lx * Math.cos(yaw);
    const z = lx * Math.sin(yaw);
    const [u, v] = rotate([x, ly], -tiltDeg); // clockwise-positive roll as the user sees it
    const seenX = cx + (size * u) / aspect;
    const seenY = cy - size * v;
    image.push({ x: 1 - seenX, y: seenY, z: size * z }); // the camera's raw frame is un-mirrored
    world.push({ x: 0.09 * u, y: -0.09 * v, z: 0.09 * z }); // metres, y down
  }
  if (image.length !== LANDMARK_COUNT) throw new Error("fixture must have 21 landmarks");
  return { landmarks: image, worldLandmarks: world, handedness: "Right", score: 0.95 };
}
