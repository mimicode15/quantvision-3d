import type { AppHandle } from "../app";
import { GestureMapper, type GestureConfig } from "./GestureMapper";
import type { VisionHandle } from "./startVision";

/** Connects the hand-tracking pipeline to the app: pinch steers the state, an open palm measures. */
export function attachGestures(
  vision: VisionHandle,
  app: Pick<AppHandle, "getAngles" | "steer" | "measureNow">,
  config: Partial<GestureConfig> = {},
): GestureMapper {
  const mapper = new GestureMapper(() => app.getAngles(), config);

  vision.pipeline.onStatus((status) => {
    if (status.state === "running") {
      mapper.setAspect(status.size.width / status.size.height);
    } else {
      mapper.reset(); // camera stopped or failed: drop any grab in progress
    }
  });

  vision.pipeline.onFrame((frame) => {
    const output = mapper.update(frame);
    if (output.angles) app.steer(output.angles.theta, output.angles.phi);
    if (output.measure) app.measureNow("open palm");
    vision.panel.showGesture(output);
  });

  return mapper;
}
