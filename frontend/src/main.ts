import "@fontsource/michroma";
import "@fontsource/syne-mono";
import "katex/dist/katex.min.css";
import "./index.css";
import { createLayout, startApp, type SceneLike } from "./app";
import { BlochScene } from "./scene/BlochScene";
import { attachGestures } from "./vision/attachGestures";
import { startVision } from "./vision/startVision";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app is missing from index.html");

const layout = createLayout(root);

BlochScene.create(layout.stage)
  .then((scene) => startApp(layout.dock, scene))
  .catch((error: unknown) => {
    // No WebGL: say so, but keep the numeric controls working.
    console.error(error);
    layout.stage.innerHTML =
      '<p class="qv-fallback">3D view unavailable: WebGL could not start in this browser. ' +
      "The controls below still work.</p>";
    const noScene: SceneLike = { setTarget: () => {}, snapTo: () => {} };
    return startApp(layout.dock, noScene);
  })
  .then((app) => {
    // Mounted last so the WebGL fallback above can't wipe it. The camera stays off until the user clicks.
    attachGestures(startVision(layout.stage), app);
  });
