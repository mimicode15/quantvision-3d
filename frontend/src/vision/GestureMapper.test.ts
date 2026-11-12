import { describe, expect, it } from "vitest";
import { GestureMapper, type Angles, type GestureOutput } from "./GestureMapper";
import { makeHand, type HandPose } from "./handFixtures";
import type { HandFrame } from "./parse";

const FRAME = 1000 / 30;
const deg = (d: number) => (d * Math.PI) / 180;

/** Feeds frames at 30 fps and remembers the clock between calls. */
class Rig {
  t = 0;
  angles: Angles = { theta: Math.PI / 2, phi: Math.PI };
  readonly mapper: GestureMapper;
  last!: GestureOutput;
  measures = 0;

  constructor(config = {}) {
    this.mapper = new GestureMapper(() => this.angles, config);
  }

  frame(pose: HandPose | null): GestureOutput {
    const frame: HandFrame = { timestamp: this.t, hand: pose ? makeHand(pose) : null };
    this.t += FRAME;
    this.last = this.mapper.update(frame);
    if (this.last.measure) this.measures++;
    if (this.last.angles) this.angles = this.last.angles; // the app adopts steering output
    return this.last;
  }

  hold(pose: HandPose | null, ms: number): GestureOutput {
    const n = Math.max(1, Math.round(ms / FRAME));
    for (let i = 0; i < n; i++) this.frame(pose);
    return this.last;
  }
}

const OPEN = { cx: 0.5, cy: 0.5 };
/** A relaxed hand that is neither a pinch nor an open palm. */
const IDLE = { cx: 0.5, cy: 0.5, curled: ["ring", "pinky"] as const };
const PINCH = { cx: 0.5, cy: 0.5, pinch: 1 };

describe("pinch to grab", () => {
  it("does nothing until a pinch happens", () => {
    const rig = new Rig();
    const out = rig.hold(IDLE, 500);
    expect(out.mode).toBe("tracking");
    expect(out.angles).toBeNull();
  });

  it("engages after two consecutive pinched frames, not one", () => {
    const rig = new Rig();
    rig.hold(IDLE, 300);
    expect(rig.frame(PINCH).mode).toBe("tracking");
    expect(rig.frame(PINCH).mode).toBe("steering");
  });

  it("ignores a one-frame flicker", () => {
    const rig = new Rig();
    rig.hold(IDLE, 300);
    rig.frame(PINCH);
    expect(rig.frame(IDLE).mode).toBe("tracking");
    expect(rig.frame(PINCH).mode).toBe("tracking");
  });

  it("doesn't jump when the pinch begins: output starts at the current state", () => {
    const rig = new Rig();
    rig.hold(OPEN, 300);
    const out = rig.hold(PINCH, 100);
    expect(out.angles?.theta).toBeCloseTo(Math.PI / 2, 3);
    expect(out.angles?.phi).toBeCloseTo(Math.PI, 3);
  });

  it("uses hysteresis: a half-open pinch stays engaged, a clear release ends it", () => {
    const rig = new Rig();
    rig.hold(OPEN, 300);
    rig.hold(PINCH, 200);
    expect(rig.hold({ ...PINCH, pinch: 0.7 }, 200).mode).toBe("steering"); // ratio ~0.4: between thresholds
    expect(rig.hold({ ...PINCH, pinch: 0 }, 200).mode).not.toBe("steering");
  });
});

describe("steering theta with vertical motion", () => {
  const grab = (rig: Rig) => {
    rig.hold(OPEN, 300);
    rig.hold(PINCH, 200);
  };

  it("moving the hand down increases theta, up decreases it", () => {
    const down = new Rig();
    grab(down);
    const start = down.angles.theta;
    down.hold({ ...PINCH, cy: 0.55 }, 1500);
    expect(down.angles.theta).toBeGreaterThan(start);

    const up = new Rig();
    grab(up);
    up.hold({ ...PINCH, cy: 0.45 }, 1500);
    expect(up.angles.theta).toBeLessThan(start);
  });

  it("maps vertical travel to theta with the configured gain", () => {
    const rig = new Rig({ thetaGain: Math.PI / 0.5 });
    grab(rig);
    const start = rig.angles.theta;
    rig.hold({ ...PINCH, cy: 0.55 }, 2000); // 0.05 frame-heights lower
    expect(rig.angles.theta - start).toBeCloseTo((Math.PI / 0.5) * 0.05, 2);
  });

  it("clamps at the poles", () => {
    const rig = new Rig();
    grab(rig);
    rig.hold({ ...PINCH, cy: 0.95 }, 2000);
    expect(rig.angles.theta).toBeCloseTo(Math.PI, 6);
    rig.hold({ ...PINCH, cy: 0.05 }, 2000);
    // Clamped from the top too, with no overshoot.
    expect(rig.angles.theta).toBeCloseTo(0, 6);
  });

  it("responds right away when you reverse after overshooting a pole", () => {
    const rig = new Rig();
    grab(rig);
    rig.hold({ ...PINCH, cy: 0.98 }, 1500); // far past the south pole
    expect(rig.angles.theta).toBeCloseTo(Math.PI, 6);
    rig.hold({ ...PINCH, cy: 0.9 }, 1500); // come back up a little
    expect(rig.angles.theta).toBeLessThan(Math.PI - 0.3); // no dead zone
  });

  it("doesn't drift when you pinch right after moving the hand quickly", () => {
    const rig = new Rig();
    rig.hold({ ...OPEN, cy: 0.9, curled: ["ring", "pinky"] }, 300);
    rig.hold({ ...PINCH, cy: 0.5, tiltDeg: 25 }, 1500); // jump to a new spot and grab at once
    expect(rig.angles.theta).toBeCloseTo(Math.PI / 2, 2);
    expect(rig.angles.phi).toBeCloseTo(Math.PI, 2);
  });

  it("stays steady with sub-pixel hand jitter", () => {
    const rig = new Rig();
    grab(rig);
    const start = rig.angles.theta;
    for (let i = 0; i < 90; i++) rig.frame({ ...PINCH, cy: 0.5 + 0.002 * Math.sin(i * 2.1) });
    expect(Math.abs(rig.angles.theta - start)).toBeLessThan(0.06);
  });
});

describe("steering phi with wrist tilt", () => {
  const grab = (rig: Rig) => {
    rig.hold(OPEN, 300);
    rig.hold(PINCH, 200);
  };

  it("tilting right increases phi, tilting left decreases it", () => {
    const right = new Rig();
    grab(right);
    const start = right.angles.phi;
    right.hold({ ...PINCH, tiltDeg: 20 }, 1500);
    expect(right.angles.phi).toBeGreaterThan(start);

    const left = new Rig();
    grab(left);
    left.hold({ ...PINCH, tiltDeg: -20 }, 1500);
    expect(left.angles.phi).toBeLessThan(start);
  });

  it("maps tilt to phi with the configured gain", () => {
    const rig = new Rig({ phiGain: 2.5 });
    grab(rig);
    const start = rig.angles.phi;
    rig.hold({ ...PINCH, tiltDeg: 20 }, 2000);
    expect(rig.angles.phi - start).toBeCloseTo(2.5 * deg(20), 2);
  });

  it("gives the same phi on a widescreen camera once aspect is set", () => {
    const wide = 16 / 9;
    const rig = new Rig();
    rig.mapper.setAspect(wide);
    const pose = (tilt: number) => ({ ...PINCH, aspect: wide, tiltDeg: tilt });
    rig.hold({ ...OPEN, aspect: wide }, 300);
    rig.hold(pose(0), 200);
    const start = rig.angles.phi;
    rig.hold(pose(20), 2000);
    expect(rig.angles.phi - start).toBeCloseTo(2.5 * deg(20), 2);
  });

  it("keeps phi inside [0, 2pi) across the seam", () => {
    const rig = new Rig();
    rig.angles = { theta: Math.PI / 2, phi: deg(350) };
    grab(rig);
    rig.hold({ ...PINCH, tiltDeg: 30 }, 2000);
    expect(rig.angles.phi).toBeGreaterThanOrEqual(0);
    expect(rig.angles.phi).toBeLessThan(2 * Math.PI);
    expect(rig.angles.phi).toBeCloseTo((deg(350) + 2.5 * deg(30)) % (2 * Math.PI), 2);
  });

  it("steers theta and phi together", () => {
    const rig = new Rig();
    grab(rig);
    const { theta, phi } = rig.angles;
    rig.hold({ ...PINCH, cy: 0.54, tiltDeg: 15 }, 2000);
    expect(rig.angles.theta).toBeGreaterThan(theta);
    expect(rig.angles.phi).toBeGreaterThan(phi);
  });
});

describe("releasing and losing the hand", () => {
  it("keeps the state when you let go, and further motion does nothing", () => {
    const rig = new Rig();
    rig.hold(OPEN, 300);
    rig.hold(PINCH, 200);
    rig.hold({ ...PINCH, cy: 0.55 }, 1500);
    const released = rig.hold({ ...OPEN, cy: 0.55 }, 400);
    expect(released.mode).toBe("tracking"); // open hand, but locked out right after a pinch
    expect(released.angles).toBeNull();
    const held = { ...rig.angles };
    rig.hold({ ...OPEN, cy: 0.9, tiltDeg: 40 }, 800);
    expect(rig.angles).toEqual(held);
  });

  it("keeps steering through a brief dropout, then lets go", () => {
    const rig = new Rig();
    rig.hold(OPEN, 300);
    rig.hold(PINCH, 200);
    rig.hold({ ...PINCH, cy: 0.55 }, 800);
    const before = { ...rig.angles };
    const during = rig.frame(null);
    expect(during.mode).toBe("steering");
    expect(during.angles).toEqual(before);
    const after = rig.hold(null, 600);
    expect(after.mode).toBe("none");
    expect(after.angles).toBeNull();
  });

  it("reports none with no hand and nothing else", () => {
    const rig = new Rig();
    const out = rig.frame(null);
    expect(out).toEqual({
      mode: "none",
      pinchRatio: null,
      palmProgress: 0,
      angles: null,
      measure: false,
    });
  });

  it("re-grabbing anchors to the new state, not the old one", () => {
    const rig = new Rig();
    rig.hold(OPEN, 300);
    rig.hold(PINCH, 200);
    rig.hold({ ...PINCH, cy: 0.56 }, 1500);
    rig.hold({ ...OPEN, cy: 0.56 }, 300); // let go
    rig.hold({ ...OPEN, cy: 0.3 }, 300); // reposition hand without grabbing
    const before = rig.angles.theta;
    rig.hold({ ...PINCH, cy: 0.3 }, 300); // grab again, higher up
    expect(rig.angles.theta).toBeCloseTo(before, 2);
  });
});

describe("open palm to measure", () => {
  it("fires one measure event after the hold time", () => {
    const rig = new Rig({ palmHoldMs: 450 });
    rig.hold(OPEN, 300); // pose starts here
    rig.hold(OPEN, 600);
    expect(rig.measures).toBe(1);
  });

  it("shows progress while holding", () => {
    const rig = new Rig({ palmHoldMs: 900 });
    const first = rig.frame(OPEN);
    expect(first.mode).toBe("palm");
    expect(first.palmProgress).toBe(0);
    const mid = rig.hold(OPEN, 450);
    expect(mid.palmProgress).toBeGreaterThan(0.35);
    expect(mid.palmProgress).toBeLessThan(0.7);
  });

  it("doesn't fire if the palm is dropped early", () => {
    const rig = new Rig({ palmHoldMs: 450 });
    rig.hold(OPEN, 300);
    rig.hold({ ...OPEN, curled: ["index", "middle", "ring", "pinky"] }, 100);
    rig.hold(OPEN, 300);
    expect(rig.measures).toBe(0);
  });

  it("doesn't fire again while the palm stays up", () => {
    const rig = new Rig({ palmHoldMs: 450, palmCooldownMs: 1500 });
    rig.hold(OPEN, 5000);
    expect(rig.measures).toBe(1);
  });

  it("re-arms after the palm closes and the cooldown passes", () => {
    const rig = new Rig({ palmHoldMs: 450, palmCooldownMs: 1500 });
    rig.hold(OPEN, 700);
    expect(rig.measures).toBe(1);
    rig.hold({ ...OPEN, curled: ["index", "middle", "ring", "pinky"] }, 200);
    rig.hold(OPEN, 2500);
    expect(rig.measures).toBe(2);
  });

  it("waits out the cooldown even if the palm is closed and reopened quickly", () => {
    const rig = new Rig({ palmHoldMs: 450, palmCooldownMs: 1500 });
    rig.hold(OPEN, 700);
    rig.hold({ ...OPEN, curled: ["index", "middle", "ring", "pinky"] }, 100);
    rig.hold(OPEN, 600);
    expect(rig.measures).toBe(1);
  });

  it("ignores a fist, a peace sign and an edge-on hand", () => {
    for (const pose of [
      { ...OPEN, curled: ["index", "middle", "ring", "pinky"] as const },
      { ...OPEN, curled: ["ring", "pinky"] as const },
      { ...OPEN, yawDeg: 80 },
    ]) {
      const rig = new Rig();
      rig.hold(pose, 3000);
      expect(rig.measures).toBe(0);
    }
  });

  it("can't measure by accident right after letting go of a pinch", () => {
    const rig = new Rig({ palmHoldMs: 450, releaseLockoutMs: 1000 });
    rig.hold(IDLE, 300);
    rig.hold(PINCH, 300);
    rig.hold(OPEN, 900); // hand opens as you let go and stays open
    expect(rig.measures).toBe(0);
    rig.hold(OPEN, 1200); // ...but a deliberate hold after the lockout still works
    expect(rig.measures).toBe(1);
  });

  it("uses a conservative default hold time", () => {
    const rig = new Rig();
    rig.hold(OPEN, 600);
    expect(rig.measures).toBe(0);
    rig.hold(OPEN, 400);
    expect(rig.measures).toBe(1);
  });

  it("never measures while pinching", () => {
    const rig = new Rig();
    rig.hold(OPEN, 100);
    rig.hold(PINCH, 3000);
    expect(rig.measures).toBe(0);
  });

  it("re-arms when the hand leaves the frame", () => {
    const rig = new Rig({ palmHoldMs: 450, palmCooldownMs: 500 });
    rig.hold(OPEN, 700);
    rig.hold(null, 600);
    rig.hold(OPEN, 1200);
    expect(rig.measures).toBe(2);
  });
});
