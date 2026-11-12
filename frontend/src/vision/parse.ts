import { isValidHand, type Landmark } from "./landmarks";

export interface HandResult {
  /** 21 image-space landmarks (x, y in 0..1 over the video frame). */
  landmarks: Landmark[];
  /** 21 landmarks in metres, origin at the hand's centre. Useful for scale-free distances. */
  worldLandmarks: Landmark[];
  /** The label MediaPipe reports. We feed it un-mirrored video, so treat it as unreliable for now. */
  handedness: "Left" | "Right" | null;
  /** MediaPipe's confidence in the handedness label, 0..1. */
  score: number;
}

/** One processed video frame. `hand` is null when no hand was found. */
export interface HandFrame {
  timestamp: number;
  hand: HandResult | null;
}

interface RawCategory {
  categoryName?: string;
  score?: number;
}

/** The parts of MediaPipe's HandLandmarkerResult we read. Older releases spell handedness "handednesses". */
interface RawResult {
  landmarks?: Landmark[][];
  worldLandmarks?: Landmark[][];
  handedness?: RawCategory[][];
  handednesses?: RawCategory[][];
}

const copy = (points: readonly Landmark[]): Landmark[] =>
  points.map((p) => ({ x: p.x, y: p.y, z: p.z }));

/** Turns a raw MediaPipe result into plain data we own. Anything malformed becomes "no hand". */
export function parseHandResult(raw: unknown, timestamp: number): HandFrame {
  const result = (raw ?? {}) as RawResult;
  const landmarks = result.landmarks?.[0];
  if (!isValidHand(landmarks) || !landmarks) return { timestamp, hand: null };

  const world = result.worldLandmarks?.[0];
  const category = (result.handedness ?? result.handednesses)?.[0]?.[0];
  const label = category?.categoryName;

  return {
    timestamp,
    hand: {
      landmarks: copy(landmarks),
      worldLandmarks: isValidHand(world) && world ? copy(world) : copy(landmarks),
      handedness: label === "Left" || label === "Right" ? label : null,
      score: category?.score ?? 0,
    },
  };
}
