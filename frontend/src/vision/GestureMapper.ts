import { OneEuroFilter } from "./filters";
import { isOpenPalm, measureHand, wrap2Pi, wrapPi } from "./gestures";
import type { HandFrame } from "./parse";

export interface Angles {
  theta: number;
  phi: number;
}

/**
 * none      no hand in view
 * tracking  hand visible, waiting for a gesture
 * steering  pinch held: hand movement drives theta and phi
 * palm      open palm held, counting toward a measurement
 */
export type GestureMode = "none" | "tracking" | "steering" | "palm";

export interface GestureOutput {
  mode: GestureMode;
  /** Thumb-index distance over hand size, for the on-screen readout; null with no hand. */
  pinchRatio: number | null;
  /** 0..1 progress of the open-palm hold. */
  palmProgress: number;
  /** New state angles. Present only while steering. */
  angles: Angles | null;
  /** True for exactly one frame when an open-palm hold completes. */
  measure: boolean;
}

/** Every tunable number in one place. Defaults come from reasoning, not from real hands: expect to tune. */
export interface GestureConfig {
  /** Pinch starts when the ratio drops below this... */
  pinchEngage: number;
  /** ...and ends when it rises above this (higher than engage, so it doesn't flicker). */
  pinchRelease: number;
  /** Consecutive frames needed to start or end a pinch. */
  pinchFrames: number;
  /** Radians of theta per frame-height of vertical hand motion. */
  thetaGain: number;
  /** Radians of phi per radian of wrist tilt. Negative reverses the direction. */
  phiGain: number;
  /** One Euro settings for vertical position (frame-heights) and tilt (radians). */
  yFilter: { minCutoff: number; beta: number };
  tiltFilter: { minCutoff: number; beta: number };
  /** Open-palm pose strictness. */
  fingerStraightCos: number;
  palmFacingMin: number;
  /** How long the open palm must be held, and the pause before the next measurement. */
  palmHoldMs: number;
  palmCooldownMs: number;
  /** After letting go of a pinch your hand is usually open; ignore the palm for this long so it can't measure by accident. */
  releaseLockoutMs: number;
  /** Keep steering this long after the hand briefly drops out of view. */
  handLostGraceMs: number;
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  pinchEngage: 0.28,
  pinchRelease: 0.45,
  pinchFrames: 2,
  thetaGain: Math.PI / 0.5, // half the frame height sweeps pole to pole
  phiGain: 2.5, // about +/-70 degrees of wrist roll sweeps a full turn
  yFilter: { minCutoff: 1.2, beta: 6 },
  tiltFilter: { minCutoff: 1.2, beta: 1.5 },
  fingerStraightCos: 0.8,
  palmFacingMin: 0.7,
  palmHoldMs: 800,
  palmCooldownMs: 1500,
  releaseLockoutMs: 1000,
  handLostGraceMs: 250,
};

interface Anchor {
  theta0: number;
  phi0: number;
  /** Where the hand was when the pinch began; motion is measured from here. */
  y0: number;
  tilt0: number;
}

/**
 * Turns hand frames into Bloch-sphere controls.
 *   Pinch thumb and index  -> grab. While held, moving the hand steers the state *relative* to
 *                             where it was when you grabbed (so nothing jumps). Hand down = larger
 *                             theta, wrist tilted right = larger phi. Let go to keep the state.
 *   Hold an open palm      -> after palmHoldMs, request a measurement (one event, then a cooldown).
 */
export class GestureMapper {
  private readonly getAngles: () => Angles;
  private readonly config: GestureConfig;
  private readonly yFilter: OneEuroFilter;
  private readonly tiltFilter: OneEuroFilter;
  private aspect = 4 / 3;

  private pinching = false;
  private engageCount = 0;
  private releaseCount = 0;
  private anchor: Anchor | null = null;
  private lastAngles: Angles | null = null;
  private lastSeen = Number.NEGATIVE_INFINITY;

  private palmSince: number | null = null;
  private armed = true;
  private cooldownUntil = 0;
  private lockUntil = 0;

  constructor(getAngles: () => Angles, config: Partial<GestureConfig> = {}) {
    this.getAngles = getAngles;
    this.config = { ...DEFAULT_GESTURE_CONFIG, ...config };
    this.yFilter = new OneEuroFilter(this.config.yFilter.minCutoff, this.config.yFilter.beta);
    this.tiltFilter = new OneEuroFilter(
      this.config.tiltFilter.minCutoff,
      this.config.tiltFilter.beta,
    );
  }

  /** Video width / height. Needed so wrist tilt isn't skewed by a non-square frame. */
  setAspect(aspect: number): void {
    if (Number.isFinite(aspect) && aspect > 0) this.aspect = aspect;
  }

  reset(): void {
    this.yFilter.reset();
    this.tiltFilter.reset();
    this.pinching = false;
    this.engageCount = 0;
    this.releaseCount = 0;
    this.anchor = null;
    this.lastAngles = null;
    this.palmSince = null;
    this.armed = true;
    this.lockUntil = 0;
  }

  update(frame: HandFrame): GestureOutput {
    const cfg = this.config;
    const t = frame.timestamp;
    const hand = frame.hand;

    if (!hand) {
      if (this.pinching && t - this.lastSeen <= cfg.handLostGraceMs) {
        return this.output("steering", null, 0, this.lastAngles);
      }
      this.reset();
      return this.output("none", null, 0, null);
    }
    this.lastSeen = t;

    const features = measureHand(hand, this.aspect);
    // Smoothing only matters while steering. Resetting until then means the grab anchors on where the
    // hand really is, not on a filter still catching up from the last move.
    if (!this.pinching) {
      this.yFilter.reset();
      this.tiltFilter.reset();
    }
    const y = this.yFilter.filter(features.palmY, t);
    const tilt = this.tiltFilter.filter(features.tilt, t);

    if (!this.pinching) {
      this.engageCount = features.pinchRatio < cfg.pinchEngage ? this.engageCount + 1 : 0;
      if (this.engageCount >= cfg.pinchFrames) {
        this.pinching = true;
        this.engageCount = 0;
        this.releaseCount = 0;
        this.palmSince = null;
        const start = this.getAngles();
        this.anchor = { theta0: start.theta, phi0: start.phi, y0: y, tilt0: tilt };
        this.lastAngles = start;
      }
    } else {
      this.releaseCount = features.pinchRatio > cfg.pinchRelease ? this.releaseCount + 1 : 0;
      if (this.releaseCount >= cfg.pinchFrames) {
        this.pinching = false;
        this.releaseCount = 0;
        this.anchor = null;
        this.lastAngles = null;
        this.lockUntil = t + cfg.releaseLockoutMs;
      }
    }

    if (this.pinching && this.anchor) {
      const a = this.anchor;
      let theta = a.theta0 + cfg.thetaGain * (y - a.y0);
      // Pushing past a pole slides the anchor along, so coming back responds immediately.
      if (theta > Math.PI) {
        a.y0 = y - (Math.PI - a.theta0) / cfg.thetaGain;
        theta = Math.PI;
      } else if (theta < 0) {
        a.y0 = y + a.theta0 / cfg.thetaGain;
        theta = 0;
      }
      const phi = wrap2Pi(a.phi0 + cfg.phiGain * wrapPi(tilt - a.tilt0));
      this.lastAngles = { theta, phi };
      return this.output("steering", features.pinchRatio, 0, this.lastAngles);
    }

    const open =
      t >= this.lockUntil &&
      features.pinchRatio > cfg.pinchRelease &&
      isOpenPalm(hand.worldLandmarks, cfg);
    if (!open) {
      this.palmSince = null;
      this.armed = true;
      return this.output("tracking", features.pinchRatio, 0, null);
    }

    this.palmSince ??= t;
    const progress = Math.min(1, (t - this.palmSince) / cfg.palmHoldMs);
    if (this.armed && progress >= 1 && t >= this.cooldownUntil) {
      this.armed = false;
      this.cooldownUntil = t + cfg.palmCooldownMs;
      return this.output("palm", features.pinchRatio, 1, null, true);
    }
    return this.armed
      ? this.output("palm", features.pinchRatio, progress, null)
      : this.output("tracking", features.pinchRatio, 0, null);
  }

  private output(
    mode: GestureMode,
    pinchRatio: number | null,
    palmProgress: number,
    angles: Angles | null,
    measure = false,
  ): GestureOutput {
    return { mode, pinchRatio, palmProgress, angles, measure };
  }
}
