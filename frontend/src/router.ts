export type Route = "home" | "play";

/** "#/play" -> "play". Anything unknown falls back to the home page. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").split(/[?#]/)[0];
  return path === "play" ? "play" : "home";
}

/** A page mounts itself into `root` and returns a function that cleans it up. */
export type Mount = (root: HTMLElement) => () => void;

export function startRouter(root: HTMLElement, pages: Record<Route, Mount>): void {
  let cleanup: (() => void) | null = null;

  const show = (): void => {
    cleanup?.();
    root.replaceChildren();
    const route = parseRoute(window.location.hash);
    document.body.dataset.page = route;
    document.title = route === "play" ? "Playground · QuantVision" : "QuantVision";
    window.scrollTo(0, 0);
    cleanup = pages[route](root);
  };

  window.addEventListener("hashchange", show);
  show();
}
