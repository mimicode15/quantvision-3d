import "@fontsource/michroma";
import "@fontsource/syne-mono";
import "katex/dist/katex.min.css";
import "./index.css";
import { createLayout, startApp, type AppHandle, type SceneLike } from "./app";
import { DocsDrawer } from "./components/DocsDrawer";
import { installErrorBoundary } from "./errors/boundary";
import { mountLanding } from "./pages/landing";
import { perfRequested, setMarks } from "./perf/marks";
import { PerfOverlay } from "./perf/PerfOverlay";
import { startRouter, type Mount } from "./router";
import { BlochScene } from "./scene/BlochScene";
import { attachGestures } from "./vision/attachGestures";
import { startVision, type VisionHandle } from "./vision/startVision";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app is missing from index.html");

installErrorBoundary();
setMarks(perfRequested());

const mountPlayground: Mount = (el) => {
  const layout = createLayout(el);
  const drawer = new DocsDrawer();
  el.append(drawer.element);
  layout.docsButton.addEventListener("click", () => drawer.open(layout.docsButton));

  let gone = false;
  let scene: BlochScene | null = null;
  let app: AppHandle | null = null;
  let vision: VisionHandle | null = null;

  // Frame-rate readout for profiling. Open the page with ?perf, or press Shift+P.
  const perf = new PerfOverlay(() => ({
    render: scene?.stats,
    pixelRatio: scene?.pixelRatio,
    tracker:
      vision?.pipeline.status.state === "running"
        ? { fps: vision.pipeline.fps, detectMs: vision.pipeline.detectMs }
        : undefined,
  }));
  el.append(perf.element);
  if (perfRequested()) perf.show();
  const onKey = (event: KeyboardEvent): void => {
    const typing = (event.target as HTMLElement | null)?.closest("input, textarea, select");
    if (event.shiftKey && event.key === "P" && !typing) perf.toggle();
  };
  window.addEventListener("keydown", onKey);

  // The browser can take the graphics context away (driver reset, too many tabs).
  const notice = (text: string): void => {
    layout.stage.querySelector(".qv-notice")?.remove();
    if (!text) return;
    const p = document.createElement("p");
    p.className = "qv-fallback qv-notice";
    p.setAttribute("role", "status");
    p.textContent = text;
    layout.stage.append(p);
  };
  let restoreTimer: ReturnType<typeof setTimeout> | undefined;

  const boot = async (): Promise<void> => {
    try {
      const created = await BlochScene.create(layout.stage);
      if (gone) {
        created.dispose();
        return;
      }
      scene = created;
      created.onContextChange((state) => {
        clearTimeout(restoreTimer);
        if (state === "restored") return notice("");
        notice("The 3D view lost its graphics context. Trying to bring it back…");
        restoreTimer = setTimeout(
          () => notice("Couldn't restore the 3D view. Reload the page. The sliders still work."),
          5000,
        );
      });
      app = startApp(layout.dock, created);
    } catch (error) {
      if (gone) return;
      // No WebGL: say so, but keep the numeric controls working.
      console.error(error);
      layout.stage.innerHTML =
        '<p class="qv-fallback">3D view unavailable: WebGL could not start in this browser. ' +
        "The controls below still work.</p>";
      const noScene: SceneLike = { setTarget: () => {}, snapTo: () => {} };
      app = startApp(layout.dock, noScene);
    }
    // Mounted last so the WebGL fallback above can't wipe it. The camera stays off until the user clicks.
    vision = startVision(layout.stage);
    attachGestures(vision, app);
  };
  void boot();

  return () => {
    gone = true;
    clearTimeout(restoreTimer);
    window.removeEventListener("keydown", onKey);
    perf.dispose();
    vision?.pipeline.stop();
    app?.dispose();
    scene?.dispose();
  };
};

startRouter(root, { home: mountLanding, play: mountPlayground });
