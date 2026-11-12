import { CameraPanel } from "../components/CameraPanel";
import { CameraManager, type CameraLike } from "./CameraManager";
import { HandTracker, type TrackerLike } from "./HandTracker";
import { VisionPipeline } from "./VisionPipeline";

export interface VisionDeps {
  camera?: CameraLike;
  createTracker?: () => Promise<TrackerLike>;
}

export interface VisionHandle {
  pipeline: VisionPipeline;
  panel: CameraPanel;
}

/** Mounts the camera card into the stage and wires it to the pipeline. The camera stays off until the user opts in. */
export function startVision(stage: HTMLElement, deps: VisionDeps = {}): VisionHandle {
  const panel = new CameraPanel({
    onToggle: () => {
      if (pipeline.status.state === "running") pipeline.stop();
      else void pipeline.start();
    },
  });
  const pipeline = new VisionPipeline({
    video: panel.video,
    camera: deps.camera ?? new CameraManager(),
    createTracker: deps.createTracker ?? (() => HandTracker.create()),
  });
  pipeline.onStatus((status) => panel.setStatus(status));
  pipeline.onFrame((frame, fps) => panel.showFrame(frame, fps));
  stage.append(panel.element);
  window.addEventListener("pagehide", () => pipeline.stop());
  return { pipeline, panel };
}
